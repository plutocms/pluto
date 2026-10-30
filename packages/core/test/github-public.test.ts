import { generateKeyPairSync } from 'node:crypto'
import { defineEventHandler, getQuery, getRouterParam } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { gitBlobSha } from '../modules/pluto-github/runtime/server/utils/blob-sha'
import { createGithubCache } from '../modules/pluto-github/runtime/server/utils/github-cache'
import {
  getRegisteredGithubCache,
  registerGithubContent,
} from '../modules/pluto-github/runtime/server/utils/github-setup'
import {
  getPublicContent,
  listPublicContent,
} from '../server/utils/pluto-public-api'
import { createFakeGithub } from './fixtures/fake-github'
import {
  createAuthApp,
  resetTestConfig,
  signIn,
} from './fixtures/github-auth-harness'

// The posts of the GitHub CMS through the public API of core (`/api/pluto/v1/content/post`).

vi.mock(
  '../modules/pluto-github/runtime/server/utils/github-config',
  async () => {
    const { testConfig } = await import('./fixtures/github-test-config')
    return { getGithubConfig: () => testConfig }
  }
)

const apiConfig = vi.hoisted(() => ({
  value: { cors: true as boolean | string[], maxAge: 60 },
}))
vi.mock('../server/utils/pluto-api-config', () => ({
  getPlutoApiConfig: () => apiConfig.value,
}))

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})

function post(
  title: string,
  status: string,
  createdAt: string,
  body: string,
  extra = ''
): string {
  return `---\ntitle: ${title}\nstatus: ${status}\ncreatedAt: ${createdAt}\n${extra}---\n${body}\n`
}

const FILES: Record<string, string> = {
  'content/posts/live.md': post(
    'Live',
    'published',
    '2026-01-01T00:00:00.000Z',
    'Hello **world**.\n\n| A | B |\n|---|---|\n| 1 | 2 |'
  ),
  'content/posts/with-excerpt.md': post(
    'With excerpt',
    'published',
    '2026-01-03T00:00:00.000Z',
    'Body text.',
    'excerpt: My own excerpt\n'
  ),
  'content/posts/secret.md': post(
    'Secret',
    'draft',
    '2026-01-02T00:00:00.000Z',
    'Not yet'
  ),
  'content/posts/evil.md': post(
    'Evil',
    'published',
    '2026-01-04T00:00:00.000Z',
    'Hi\n\n<script>alert(1)</script>\n\n[x](javascript:alert(1))'
  ),
  'content/posts/long.md': post(
    'Long',
    'published',
    '2026-01-05T00:00:00.000Z',
    `${'word '.repeat(100)}`
  ),
}

function setup() {
  const fake = createFakeGithub({
    files: { ...FILES },
    users: {
      ada: { id: 7, permission: 'push' },
      boss: { id: 8, permission: 'admin' },
    },
    app: { id: '12345', installationId: 99, publicKey },
  })
  const config = resetTestConfig(fake, { appId: '12345', privateKey })
  registerGithubContent(config, createGithubCache({ headTtl: 0 }))

  const app = createAuthApp((router) => {
    router.get(
      '/api/pluto/v1/content/:type',
      defineEventHandler((event) =>
        listPublicContent(
          event,
          getRouterParam(event, 'type') ?? '',
          getQuery(event)
        )
      )
    )
    router.get(
      '/api/pluto/v1/content/:type/:id',
      defineEventHandler((event) =>
        getPublicContent(
          event,
          getRouterParam(event, 'type') ?? '',
          getRouterParam(event, 'id', { decode: true }) ?? ''
        )
      )
    )
  })
  return { fake, app, config }
}

const LIST = '/api/pluto/v1/content/post'

interface ListBody {
  data: Array<Record<string, unknown>>
  meta: {
    total: number
    limit: number
    offset: number
  }
}

beforeEach(() => {
  apiConfig.value = { cors: true, maxAge: 60 }
  setup()
})

describe('the post list', () => {
  it('lists published items only, newest first, with the meta', async () => {
    const { app } = setup()

    const response = await app.request(LIST)
    const body = (await response.json()) as ListBody

    expect(response.status).toBe(200)
    expect(body.data.map((item) => item.id)).toEqual([
      'long',
      'evil',
      'with-excerpt',
      'live',
    ])
    expect(body.meta).toEqual({ total: 4, limit: 20, offset: 0 })
  })

  it('returns no body, no draft, and no internal key', async () => {
    const { app } = setup()

    const body = (await (await app.request(LIST)).json()) as ListBody

    for (const item of body.data) {
      expect(item).not.toHaveProperty('content')
      expect(item).not.toHaveProperty('html')
      expect(item).not.toHaveProperty('_version')
      expect(item).not.toHaveProperty('status')
      expect(typeof item.excerpt).toBe('string')
      expect(typeof item.createdAt).toBe('string')
    }
    expect(JSON.stringify(body)).not.toContain('Secret')
    expect(JSON.stringify(body)).not.toContain('Not yet')
  })

  it('uses the excerpt field, and falls back to the start of the body as plain text', async () => {
    const { app } = setup()

    const body = (await (await app.request(LIST)).json()) as ListBody
    const byId = Object.fromEntries(
      body.data.map((item) => [item.id as string, item])
    )

    expect(byId['with-excerpt']!.excerpt).toBe('My own excerpt')
    expect(byId.live!.excerpt).toBe('Hello world. A B 1 2')
    expect(byId.evil!.excerpt).not.toContain('<script')
  })

  it('cuts a long fallback excerpt to 200 characters', async () => {
    const { app } = setup()

    const body = (await (await app.request(LIST)).json()) as ListBody
    const long = body.data.find((item) => item.id === 'long')!

    expect((long.excerpt as string).length).toBeLessThanOrEqual(200)
    expect((long.excerpt as string).endsWith('…')).toBe(true)
  })

  it('applies limit and offset', async () => {
    const { app } = setup()

    const first = (await (
      await app.request(`${LIST}?limit=2`)
    ).json()) as ListBody
    const second = (await (
      await app.request(`${LIST}?limit=2&offset=2`)
    ).json()) as ListBody

    expect(first.data.map((item) => item.id)).toEqual(['long', 'evil'])
    expect(second.data.map((item) => item.id)).toEqual(['with-excerpt', 'live'])
    expect(second.meta).toEqual({ total: 4, limit: 2, offset: 2 })
  })

  it('sorts by a public field or a timestamp, and filters by a field', async () => {
    const { app } = setup()

    const byTitle = (await (
      await app.request(`${LIST}?sort=title`)
    ).json()) as ListBody
    expect(byTitle.data.map((item) => item.id)).toEqual([
      'evil',
      'live',
      'long',
      'with-excerpt',
    ])

    const oldest = (await (
      await app.request(`${LIST}?sort=createdAt&limit=1`)
    ).json()) as ListBody
    expect(oldest.data.map((item) => item.id)).toEqual(['live'])

    const filtered = (await (
      await app.request(`${LIST}?filter[title]=Evil`)
    ).json()) as ListBody
    expect(filtered.data.map((item) => item.id)).toEqual(['evil'])
    expect(filtered.meta.total).toBe(1)
  })

  it('answers 400 for a sort or a filter on an unknown field', async () => {
    const { app } = setup()

    expect((await app.request(`${LIST}?sort=secretColumn`)).status).toBe(400)
    expect((await app.request(`${LIST}?filter[status]=draft`)).status).toBe(400)
  })

  it('never shows drafts, whatever the query says', async () => {
    const { app } = setup()

    for (const query of [
      'includeUnpublished=true',
      'published=0',
      'drafts=1',
      'status=draft',
      'search=Secret',
    ]) {
      const body = (await (
        await app.request(`${LIST}?${query}`)
      ).json()) as ListBody

      expect(body.data.map((item) => item.id)).not.toContain('secret')
    }
  })

  it('answers 404 for an unknown type', async () => {
    const { app } = setup()

    expect((await app.request('/api/pluto/v1/content/nope')).status).toBe(404)
  })
})

describe('one post', () => {
  it('returns a published item with the Markdown body and sanitized html', async () => {
    const { app } = setup()

    const response = await app.request(`${LIST}/live`)
    const { data } = (await response.json()) as {
      data: Record<string, unknown>
    }

    expect(response.status).toBe(200)
    expect(data).toMatchObject({
      id: 'live',
      title: 'Live',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    expect(data.html).toContain('<strong>world</strong>')
    expect(data.html).toContain('<table>')
    expect(data).not.toHaveProperty('_version')
    expect(data).not.toHaveProperty('_frontmatter')
  })

  it('removes script, raw HTML and javascript: links from the html', async () => {
    const { app } = setup()

    const { data } = (await (await app.request(`${LIST}/evil`)).json()) as {
      data: {
        html: string
      }
    }

    expect(data.html).not.toContain('<script')
    expect(data.html).not.toContain('javascript:')
    expect(data.html).not.toContain('href')
  })

  it('answers 404 for a draft', async () => {
    const { app } = setup()

    expect((await app.request(`${LIST}/secret`)).status).toBe(404)
  })

  it('answers 404 for a draft even with a push user signed in', async () => {
    const { app, fake } = setup()
    const { done } = await signIn(app, fake, 'ada')
    expect(done.status).toBe(302)

    expect((await app.request(`${LIST}/secret`)).status).toBe(404)
    const body = (await (await app.request(LIST)).json()) as ListBody
    expect(body.data.map((item) => item.id)).not.toContain('secret')
  })

  it('answers 404 for a missing slug', async () => {
    const { app } = setup()

    expect((await app.request(`${LIST}/missing`)).status).toBe(404)
  })

  it('never answers 200 or 500 for a bad slug', async () => {
    const { app } = setup()

    for (const slug of [
      'Bad_Slug',
      'UPPER',
      'a--b',
      '-a',
      'a.b',
      'a%2fb',
      'x'.repeat(101),
    ]) {
      expect([400, 404], slug).toContain(
        (await app.request(`${LIST}/${slug}`)).status
      )
    }
  })

  it('keeps the rendered html in the cache by blob id', async () => {
    const { app } = setup()

    const { data } = (await (await app.request(`${LIST}/live`)).json()) as {
      data: {
        html: string
      }
    }
    // The html is in the cache under the blob id of the file.
    const oid = gitBlobSha(FILES['content/posts/live.md']!)
    expect(
      await getRegisteredGithubCache().getBlob<string>(`html:${oid}`)
    ).toBe(data.html)
  })
})

describe('the answers are anonymous and cacheable', () => {
  it('sets Cache-Control with the default max age', async () => {
    const { app } = setup()

    for (const path of [LIST, `${LIST}/live`]) {
      const response = await app.request(path)

      expect(response.headers.get('cache-control')).toBe(
        'public, s-maxage=60, stale-while-revalidate=300'
      )
    }
  })

  it('sends no-store when maxAge is 0', async () => {
    apiConfig.value = { cors: true, maxAge: 0 }
    const { app } = setup()

    expect((await app.request(LIST)).headers.get('cache-control')).toBe(
      'no-store'
    )
  })

  it('does not set a cache header on an error', async () => {
    const { app } = setup()

    expect(
      (await app.request(`${LIST}/secret`)).headers.get('cache-control') ?? ''
    ).not.toContain('public')
  })

  it('sets no cookie, signed out or signed in', async () => {
    const { app, fake } = setup()

    for (const path of [LIST, `${LIST}/live`, `${LIST}/secret`]) {
      expect((await app.request(path)).headers.getSetCookie()).toEqual([])
    }

    await signIn(app, fake, 'ada')
    expect(app.jar.size).toBeGreaterThan(0)

    for (const path of [LIST, `${LIST}/live`, `${LIST}/secret`]) {
      expect((await app.request(path)).headers.getSetCookie()).toEqual([])
    }
  })

  it('does not read the session: a signed-in request gets the same answer as an anonymous one', async () => {
    const { app, fake } = setup()
    const anonymous = await (await app.request(LIST)).json()

    await signIn(app, fake, 'boss')

    expect(await (await app.request(LIST)).json()).toEqual(anonymous)
  })

  it('never opens the session cookie, even a bad one', async () => {
    const { app } = setup()

    const response = await app.request(LIST, {
      headers: { cookie: 'pluto-github-session=garbage' },
    })

    expect(response.status).toBe(200)
    expect(response.headers.getSetCookie()).toEqual([])
  })
})
