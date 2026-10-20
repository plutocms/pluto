import { generateKeyPairSync } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import itemRoute from '../modules/pluto-cms/runtime/server/api/public/[type]/[slug].get'
import listRoute from '../modules/pluto-cms/runtime/server/api/public/[type]/index.get'
import { createCmsCache } from '../modules/pluto-cms/runtime/server/utils/cms-cache'
import { getRegisteredCmsCache, registerCmsContent } from '../modules/pluto-cms/runtime/server/utils/cms-setup'
import { parsePaging } from '../modules/pluto-cms/runtime/server/utils/public-content'
import { createAuthApp, resetTestConfig, signIn } from './fixtures/cms-auth-harness'
import { createFakeGithub } from './fixtures/fake-github'

vi.mock('../modules/pluto-cms/runtime/server/utils/cms-config', async () => {
  const { testConfig } = await import('./fixtures/cms-test-config')
  return { getCmsConfig: () => testConfig }
})

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})

function post(title: string, status: string, createdAt: string, body: string, extra = ''): string {
  return `---\ntitle: ${title}\nstatus: ${status}\ncreatedAt: ${createdAt}\n${extra}---\n${body}\n`
}

const FILES: Record<string, string> = {
  'content/posts/live.md': post('Live', 'published', '2026-01-01T00:00:00.000Z', 'Hello **world**.\n\n| A | B |\n|---|---|\n| 1 | 2 |'),
  'content/posts/with-excerpt.md': post('With excerpt', 'published', '2026-01-03T00:00:00.000Z', 'Body text.', 'excerpt: My own excerpt\n'),
  'content/posts/secret.md': post('Secret', 'draft', '2026-01-02T00:00:00.000Z', 'Not yet'),
  'content/posts/evil.md': post('Evil', 'published', '2026-01-04T00:00:00.000Z', 'Hi\n\n<script>alert(1)</script>\n\n[x](javascript:alert(1))'),
  'content/posts/long.md': post('Long', 'published', '2026-01-05T00:00:00.000Z', `${'word '.repeat(100)}`),
}

function setup(patch: Parameters<typeof resetTestConfig>[1] = {}) {
  const fake = createFakeGithub({
    files: { ...FILES },
    users: { ada: { id: 7, permission: 'push' }, boss: { id: 8, permission: 'admin' } },
    app: { id: '12345', installationId: 99, publicKey },
  })
  const config = resetTestConfig(fake, { appId: '12345', privateKey, ...patch })
  registerCmsContent(config, createCmsCache({ headTtl: 0 }))

  const app = createAuthApp((router) => {
    router.get('/api/_pluto/cms/:type', listRoute)
    router.get('/api/_pluto/cms/:type/:slug', itemRoute)
  })
  return { fake, app, config }
}

const LIST = '/api/_pluto/cms/post'

interface ListBody {
  data: Array<Record<string, unknown>>
  total: number
  limit: number
  offset: number
}

beforeEach(() => {
  setup()
})

describe('public list route', () => {
  it('lists published items only, newest first', async () => {
    const { app } = setup()

    const response = await app.request(LIST)
    const body = await response.json() as ListBody

    expect(response.status).toBe(200)
    expect(body.data.map((item) => item.id)).toEqual(['long', 'evil', 'with-excerpt', 'live'])
    expect(body.total).toBe(4)
  })

  it('returns no body and no draft key', async () => {
    const { app } = setup()

    const body = await (await app.request(LIST)).json() as ListBody

    for (const item of body.data) {
      expect(item).not.toHaveProperty('content')
      expect(item).not.toHaveProperty('html')
      expect(typeof item.excerpt).toBe('string')
    }
    expect(JSON.stringify(body)).not.toContain('Secret')
    expect(JSON.stringify(body)).not.toContain('Not yet')
  })

  it('uses the excerpt field, and falls back to the start of the body as plain text', async () => {
    const { app } = setup()

    const body = await (await app.request(LIST)).json() as ListBody
    const byId = Object.fromEntries(body.data.map((item) => [item.id as string, item]))

    expect(byId['with-excerpt']!.excerpt).toBe('My own excerpt')
    expect(byId.live!.excerpt).toBe('Hello world. A B 1 2')
    expect(byId.evil!.excerpt).not.toContain('<script')
  })

  it('cuts a long fallback excerpt to 200 characters', async () => {
    const { app } = setup()

    const body = await (await app.request(LIST)).json() as ListBody
    const long = body.data.find((item) => item.id === 'long')!

    expect((long.excerpt as string).length).toBeLessThanOrEqual(200)
    expect((long.excerpt as string).endsWith('…')).toBe(true)
  })

  it('applies limit and offset', async () => {
    const { app } = setup()

    const first = await (await app.request(`${LIST}?limit=2`)).json() as ListBody
    const second = await (await app.request(`${LIST}?limit=2&offset=2`)).json() as ListBody

    expect(first.data.map((item) => item.id)).toEqual(['long', 'evil'])
    expect(second.data.map((item) => item.id)).toEqual(['with-excerpt', 'live'])
    expect(second).toMatchObject({ total: 4, limit: 2, offset: 2 })
  })

  it('caps the limit at 100 and uses 20 for a bad value', async () => {
    const { app } = setup()

    expect(((await (await app.request(`${LIST}?limit=100000`)).json()) as ListBody).limit).toBe(100)
    expect(((await (await app.request(`${LIST}?limit=abc`)).json()) as ListBody).limit).toBe(20)
    expect(((await (await app.request(`${LIST}?limit=-5&offset=-3`)).json()) as ListBody)).toMatchObject({ limit: 20, offset: 0 })
    expect(((await (await app.request(`${LIST}?limit=0`)).json()) as ListBody).limit).toBe(1)
  })

  it('never shows drafts, whatever the query says', async () => {
    const { app } = setup()

    for (const query of ['includeUnpublished=true', 'published=0', 'drafts=1', 'status=draft', 'search=Secret']) {
      const body = await (await app.request(`${LIST}?${query}`)).json() as ListBody

      expect(body.data.map((item) => item.id)).not.toContain('secret')
    }
  })

  it('answers 404 for an unknown type', async () => {
    const { app } = setup()

    expect((await app.request('/api/_pluto/cms/nope')).status).toBe(404)
  })
})

describe('public item route', () => {
  it('returns a published item with sanitized html', async () => {
    const { app } = setup()

    const response = await app.request(`${LIST}/live`)
    const body = await response.json() as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ id: 'live', title: 'Live' })
    expect(body.html).toContain('<strong>world</strong>')
    expect(body.html).toContain('<table>')
  })

  it('removes script, raw HTML and javascript: links from the html', async () => {
    const { app } = setup()

    const body = await (await app.request(`${LIST}/evil`)).json() as {
 html: string
}

    expect(body.html).not.toContain('<script')
    expect(body.html).not.toContain('javascript:')
    expect(body.html).not.toContain('href')
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
    const body = await (await app.request(LIST)).json() as ListBody
    expect(body.data.map((item) => item.id)).not.toContain('secret')
  })

  it('answers 404 for a missing slug', async () => {
    const { app } = setup()

    expect((await app.request(`${LIST}/missing`)).status).toBe(404)
  })

  it('answers 400 for a bad slug', async () => {
    const { app } = setup()

    for (const slug of ['Bad_Slug', 'UPPER', 'a--b', '-a', 'a.b', 'a%2fb', 'x'.repeat(101)]) {
      expect((await app.request(`${LIST}/${slug}`)).status, slug).toBe(400)
    }
  })

  it('answers 404 for an unknown type', async () => {
    const { app } = setup()

    expect((await app.request('/api/_pluto/cms/nope/live')).status).toBe(404)
  })

  it('keeps the rendered html in the cache by blob id', async () => {
    const { app } = setup()

    const body = await (await app.request(`${LIST}/live`)).json() as {
 html: string
_version: string
}
    const cached = await getRegisteredCmsCache().getBlob<string>(`html:${body._version}`)

    expect(cached).toBe(body.html)
  })
})

describe('public routes are anonymous and cacheable', () => {
  it('sets Cache-Control with the default max age', async () => {
    const { app } = setup()

    for (const path of [LIST, `${LIST}/live`]) {
      const response = await app.request(path)

      expect(response.headers.get('cache-control')).toBe('public, s-maxage=60, stale-while-revalidate=300')
    }
  })

  it('uses the publicMaxAge option', async () => {
    const { app } = setup({ publicMaxAge: 0 })

    expect((await app.request(LIST)).headers.get('cache-control')).toBe('public, s-maxage=0, stale-while-revalidate=300')
  })

  it('does not set a cache header on an error', async () => {
    const { app } = setup()

    expect((await app.request(`${LIST}/secret`)).headers.get('cache-control') ?? '').not.toContain('public')
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

    const response = await app.request(LIST, { headers: { cookie: 'pluto-cms-session=garbage' } })

    expect(response.status).toBe(200)
    expect(response.headers.getSetCookie()).toEqual([])
  })
})

describe('parsePaging', () => {
  it('reads whole numbers and falls back for anything else', () => {
    expect(parsePaging({})).toEqual({ limit: 20, offset: 0 })
    expect(parsePaging({ limit: '5', offset: '10' })).toEqual({ limit: 5, offset: 10 })
    expect(parsePaging({ limit: ['7'], offset: '1.5' })).toEqual({ limit: 7, offset: 0 })
    expect(parsePaging({ limit: '1e3', offset: '0x10' })).toEqual({ limit: 20, offset: 0 })
    expect(parsePaging({ limit: '999' })).toEqual({ limit: 100, offset: 0 })
  })
})
