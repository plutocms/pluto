import { generateKeyPairSync } from 'node:crypto'
import { defineEventHandler, getQuery, getRouterParam } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createGithubCache } from '../modules/pluto-github/runtime/server/utils/github-cache'
import { registerGithubContent } from '../modules/pluto-github/runtime/server/utils/github-setup'
import { registerContentType } from '../server/utils/pluto-content'
import {
  contentActivity,
  getContentBackup,
  getContentItem,
  getContentRevision,
  listContentItems,
  listContentRevisions,
  listTrashItems,
  requireContentType,
} from '../server/utils/pluto-content-handlers'
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

vi.mock(
  '../modules/pluto-github/runtime/server/utils/github-config',
  async () => {
    const { testConfig } = await import('./fixtures/github-test-config')
    return { getGithubConfig: () => testConfig }
  }
)

vi.mock('../server/utils/pluto-api-config', () => ({
  getPlutoApiConfig: () => ({ cors: true, maxAge: 60 }),
}))

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})

const SECRET = 'owner@secret.example'

const FILES: Record<string, string> = {
  'content/posts/live.md': '---\ntitle: Live\nstatus: published\n---\nHello\n',
  'content/forms/one.md': `---\ntitle: One\nprivate: ${SECRET}\n---\nBody\n`,
  'content/notes/one.md': `---\ntitle: One\nprivate: ${SECRET}\n---\nBody\n`,
  'content/memos/one.md': `---\ntitle: One\nprivate: ${SECRET}\n---\nBody\n`,
}

function privateType(
  name: string,
  capabilities?: { read?: string; write?: string }
) {
  return {
    name,
    label: name,
    labelPlural: `${name}s`,
    source: `${name}s`,
    titleField: 'title',
    trash: true,
    ...(capabilities && { capabilities }),
    fields: [
      { name: 'title', type: 'text' as const, label: 'Title', required: true },
      { name: 'private', type: 'text' as const, label: 'Private' },
    ],
  }
}

function setup() {
  const fake = createFakeGithub({
    files: { ...FILES },
    users: { ada: { id: 7, permission: 'push' } },
    app: { id: '12345', installationId: 99, publicKey },
  })
  const config = resetTestConfig(fake, { appId: '12345', privateKey })
  registerGithubContent(config, createGithubCache({ headTtl: 0 }))
  registerContentType(privateType('form'))
  registerContentType(privateType('note', { read: 'notes:read' }))
  registerContentType(privateType('memo', { write: 'memos:write' }))
  registerContentType({
    ...requireContentType('post'),
    api: { public: true },
  })

  const app = createAuthApp((router) => {
    const ctx = (event: Parameters<typeof getRouterParam>[0]) => ({
      event,
      type: requireContentType(getRouterParam(event, 'type') ?? ''),
    })

    router.get(
      '/api/_pluto/content/:type',
      defineEventHandler((event) =>
        listContentItems(ctx(event), { published: false })
      )
    )
    router.get(
      '/api/_pluto/content/:type/:id',
      defineEventHandler((event) =>
        getContentItem(ctx(event), getRouterParam(event, 'id') ?? '')
      )
    )
    router.get(
      '/api/_pluto/content-activity/:type',
      defineEventHandler((event) => contentActivity(ctx(event), { weeks: 4 }))
    )
    router.get(
      '/api/_pluto/content-backup/:type',
      defineEventHandler((event) => getContentBackup(ctx(event), 'one'))
    )
    router.get(
      '/api/_pluto/content-revisions/:type/:id',
      defineEventHandler((event) =>
        listContentRevisions(ctx(event), getRouterParam(event, 'id') ?? '')
      )
    )
    router.get(
      '/api/_pluto/content-revision/:type/:revision/:id',
      defineEventHandler((event) =>
        getContentRevision(
          ctx(event),
          getRouterParam(event, 'id') ?? '',
          getRouterParam(event, 'revision') ?? ''
        )
      )
    )
    router.get(
      '/api/_pluto/content-trash/:type',
      defineEventHandler((event) => listTrashItems(ctx(event), {}))
    )
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
          getRouterParam(event, 'id') ?? ''
        )
      )
    )
  })

  return { fake, app }
}

const ROUTES = [
  '/api/_pluto/content/TYPE',
  '/api/_pluto/content/TYPE/one',
  '/api/_pluto/content-activity/TYPE',
  '/api/_pluto/content-backup/TYPE',
  '/api/_pluto/content-revisions/TYPE/one',
  '/api/_pluto/content-revision/TYPE/c1/one',
  '/api/_pluto/content-trash/TYPE',
]

describe('the admin read routes', () => {
  beforeEach(() => {
    setup()
  })

  it('refuse an anonymous caller for every type, with no data in the answer', async () => {
    const { app } = setup()

    for (const type of ['form', 'note', 'memo', 'post']) {
      for (const route of ROUTES) {
        const response = await app.request(route.replace('TYPE', type))
        const text = await response.text()

        expect([401, 403], `${type} ${route}`).toContain(response.status)
        expect(text).not.toContain(SECRET)
      }
    }
  })

  it('answer a push user', async () => {
    const { app, fake } = setup()
    expect((await signIn(app, fake, 'ada')).done.status).toBe(302)

    for (const type of ['form', 'note', 'memo']) {
      const list = await app.request(`/api/_pluto/content/${type}`)
      expect(list.status, type).toBe(200)
      expect(await list.text()).toContain(SECRET)

      for (const route of ROUTES) {
        const response = await app.request(route.replace('TYPE', type))

        if (route.includes('content-revision')) {
          expect([401, 403], `${type} ${route}`).not.toContain(response.status)
        } else {
          expect(response.status, `${type} ${route}`).toBe(200)
        }
      }
    }
  })
})

describe('the public API', () => {
  it('still answers an anonymous caller', async () => {
    const { app } = setup()

    const list = await app.request('/api/pluto/v1/content/post')
    expect(list.status).toBe(200)
    expect(((await list.json()) as { data: unknown[] }).data).toHaveLength(1)

    expect((await app.request('/api/pluto/v1/content/post/live')).status).toBe(
      200
    )
  })
})
