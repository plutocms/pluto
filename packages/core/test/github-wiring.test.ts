import { generateKeyPairSync } from 'node:crypto'
import { defineEventHandler, getQuery, getRouterParam, readBody } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createGithubCache } from '../modules/pluto-github/runtime/server/utils/github-cache'
import { registerGithubContent } from '../modules/pluto-github/runtime/server/utils/github-setup'
import {
  getContentAdapter,
  getContentType,
} from '../server/utils/pluto-content'
import {
  createContentItem,
  deleteContentItem,
  getContentItem,
  listContentItems,
  requireContentType,
} from '../server/utils/pluto-content-handlers'
import { createFakeGithub } from './fixtures/fake-github'
import {
  createAuthApp,
  resetTestConfig,
  signIn,
  testConfig,
} from './fixtures/github-auth-harness'

vi.mock(
  '../modules/pluto-github/runtime/server/utils/github-config',
  async () => {
    const { testConfig } = await import('./fixtures/github-test-config')
    return { getGithubConfig: () => testConfig }
  }
)

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})

const PUBLISHED =
  '---\ntitle: Live\nstatus: published\ncreatedAt: 2026-01-01T00:00:00.000Z\n---\nHello\n'
const DRAFT =
  '---\ntitle: Secret\nstatus: draft\ncreatedAt: 2026-01-02T00:00:00.000Z\n---\nNot yet\n'

function setup(patch: Parameters<typeof resetTestConfig>[1] = {}) {
  const fake = createFakeGithub({
    files: {
      'content/posts/live.md': PUBLISHED,
      'content/posts/secret.md': DRAFT,
    },
    users: {
      ada: { id: 7, permission: 'push' },
      boss: { id: 8, permission: 'admin' },
      reader: { id: 9, permission: 'read' },
    },
    app: { id: '12345', installationId: 99, publicKey },
  })
  const config = resetTestConfig(fake, { appId: '12345', privateKey, ...patch })
  registerGithubContent(config, createGithubCache({ headTtl: 0 }))

  // The same logic as the generic content routes in server/api/_pluto/content.
  const app = createAuthApp((router) => {
    router.get(
      '/api/_pluto/content/:type',
      defineEventHandler((event) => {
        const type = requireContentType(getRouterParam(event, 'type') ?? '')
        const published = getQuery(event).published === '1'
        return listContentItems({ event, type }, { published })
      })
    )
    router.get(
      '/api/_pluto/content/:type/:id',
      defineEventHandler((event) => {
        const type = requireContentType(getRouterParam(event, 'type') ?? '')
        return getContentItem(
          { event, type },
          getRouterParam(event, 'id') ?? ''
        )
      })
    )
    router.post(
      '/api/_pluto/content/:type',
      defineEventHandler(async (event) => {
        const type = requireContentType(getRouterParam(event, 'type') ?? '')
        return createContentItem({ event, type }, await readBody(event))
      })
    )
    router.delete(
      '/api/_pluto/content/:type/:id',
      defineEventHandler(async (event) => {
        const type = requireContentType(getRouterParam(event, 'type') ?? '')
        await deleteContentItem(
          { event, type },
          getRouterParam(event, 'id') ?? ''
        )
        return { ok: true }
      })
    )
  })
  return { fake, app, config }
}

describe('registerGithubContent', () => {
  it('registers the post type and the Markdown adapter', () => {
    setup()

    expect(getContentType('post')?.source).toBe('posts')
    expect(getContentAdapter()?.id).toBe('markdown')
  })

  it('registers no post type when postType is off, and still the adapter', async () => {
    vi.resetModules()
    const registry = await import('../server/utils/pluto-content')
    const wiring =
      await import('../modules/pluto-github/runtime/server/utils/github-setup')
    const cache = createGithubCache({ headTtl: 0 })

    wiring.registerGithubContent({ ...testConfig, postType: false }, cache)

    expect(registry.getContentType('post')).toBeUndefined()
    expect(registry.getContentAdapter()?.id).toBe('markdown')
  })
})

describe('anonymous callers', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('cannot create: 401', async () => {
    const { app, fake } = setup()

    const response = await app.request('/api/_pluto/content/post', {
      method: 'POST',
      body: { title: 'Hi', content: 'x' },
    })

    expect(response.status).toBe(401)
    expect((await response.json()).data.i18n.key).toBe(
      'pluto.github.errors.signInRequired'
    )
    expect(fake.calls.commit).toBe(0)
  })

  it('cannot delete: 401', async () => {
    const { app, fake } = setup()

    expect(
      (await app.request('/api/_pluto/content/post/live', { method: 'DELETE' }))
        .status
    ).toBe(401)
    expect(fake.read('content/posts/live.md')).toBe(PUBLISHED)
  })

  it('see published posts only, even when the list asks for drafts', async () => {
    const { app } = setup()

    const list = await (await app.request('/api/_pluto/content/post')).json()

    expect(list.data.map((item: { slug: string }) => item.slug)).toEqual([
      'live',
    ])
    expect((await app.request('/api/_pluto/content/post/secret')).status).toBe(
      404
    )
    expect((await app.request('/api/_pluto/content/post/live')).status).toBe(
      200
    )
  })

  it('read with an installation token of the App', async () => {
    const { app, fake } = setup()

    await app.request('/api/_pluto/content/post')

    const tokens = new Set(fake.calls.graphqlTokens)
    expect(tokens.size).toBe(1)
    expect([...tokens][0]).toMatch(/^ghs_/)
    expect(fake.appCalls.tokenRequests).toEqual([
      { repositories: ['site'], permissions: { contents: 'read' } },
    ])
  })

  it('read with the read token when it is set, and never ask the App', async () => {
    const { app, fake } = setup({ readToken: 'github_pat_ro' })

    await app.request('/api/_pluto/content/post')

    expect(new Set(fake.calls.graphqlTokens)).toEqual(
      new Set(['github_pat_ro'])
    )
    expect(fake.appCalls.lookups).toBe(0)
  })

  it('get a 503 when no read credentials are set', async () => {
    const { app } = setup({ appId: '', privateKey: '' })

    const response = await app.request('/api/_pluto/content/post')

    expect(response.status).toBe(503)
    expect((await response.json()).data.i18n.key).toBe(
      'pluto.github.errors.githubUnavailable'
    )
  })
})

describe('signed-in callers', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('with push can create, and the commit uses their own token', async () => {
    const { app, fake } = setup()
    await signIn(app, fake, 'ada')

    const response = await app.request('/api/_pluto/content/post', {
      method: 'POST',
      body: { title: 'Fresh post', content: 'Body', status: 'draft' },
    })

    expect(response.status).toBe(200)
    expect((await response.json()).slug).toBe('fresh-post')
    expect(fake.read('content/posts/fresh-post.md')).toContain(
      'title: Fresh post'
    )
    expect(fake.calls.graphqlTokens.at(-1)).toBe(fake.oauth.last.accessToken)
  })

  it('with push see drafts', async () => {
    const { app, fake } = setup()
    await signIn(app, fake, 'ada')

    const list = await (await app.request('/api/_pluto/content/post')).json()

    expect(list.data.map((item: { slug: string }) => item.slug).sort()).toEqual(
      ['live', 'secret']
    )
    expect((await app.request('/api/_pluto/content/post/secret')).status).toBe(
      200
    )
  })

  it('with admin can delete', async () => {
    const { app, fake } = setup()
    await signIn(app, fake, 'boss')

    expect(
      (await app.request('/api/_pluto/content/post/live', { method: 'DELETE' }))
        .status
    ).toBe(200)
    expect(fake.read('content/posts/live.md')).toBeUndefined()
  })

  it('cannot create after sign-out', async () => {
    const { app, fake } = setup()
    await signIn(app, fake, 'ada')
    await app.request('/api/_pluto/auth/logout', { method: 'POST' })

    const response = await app.request('/api/_pluto/content/post', {
      method: 'POST',
      body: { title: 'Late', content: 'x' },
    })

    expect(response.status).toBe(401)
  })

  it('cannot write across origins, even with a valid session', async () => {
    const { app, fake } = setup()
    await signIn(app, fake, 'ada')

    const response = await app.request('/api/_pluto/content/post', {
      method: 'POST',
      headers: { origin: 'https://evil.test' },
      body: { title: 'Forged', content: 'x' },
    })

    expect(response.status).toBe(403)
    expect(fake.read('content/posts/forged.md')).toBeUndefined()
  })

  it('without push cannot sign in at all, so cannot write', async () => {
    const { app, fake } = setup()

    const { done } = await signIn(app, fake, 'reader')

    expect(done.location).toBe('/admin/login?error=forbidden')
    expect(
      (
        await app.request('/api/_pluto/content/post', {
          method: 'POST',
          body: { title: 'No', content: 'x' },
        })
      ).status
    ).toBe(401)
  })

  it('test config is the one the routes use', () => {
    expect(testConfig.repo).toBe('acme/site')
  })
})
