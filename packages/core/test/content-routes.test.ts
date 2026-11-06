import * as h3 from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The item routes take the rest of the path as `id`, so a nested id (`a/b`)
// reaches the handlers whole. This test mounts the real route files in an h3
// router and calls them like a browser. The Nuxt auto-imports are stubs.

const calls: {
  op: string
  id: unknown
  body?: unknown
}[] = []

beforeEach(() => {
  calls.length = 0
  vi.stubGlobal('defineEventHandler', h3.defineEventHandler)
  vi.stubGlobal('getRouterParam', h3.getRouterParam)
  vi.stubGlobal('readBody', h3.readBody)
  vi.stubGlobal('requireContentType', () => ({ name: 'doc' }))
  vi.stubGlobal('getContentItem', async (_ctx: unknown, id: string) => {
    calls.push({ op: 'get', id })
    return { id }
  })
  vi.stubGlobal(
    'updateContentItem',
    async (_ctx: unknown, id: string, body: unknown) => {
      calls.push({ op: 'update', id, body })
      return { id }
    }
  )
  vi.stubGlobal('deleteContentItem', async (_ctx: unknown, id: string) => {
    calls.push({ op: 'delete', id })
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function handler() {
  const base = '../server/api/_pluto/content/[type]/'
  const get = (await import(`${base}[...id].get`)).default
  const patch = (await import(`${base}[...id].patch`)).default
  const remove = (await import(`${base}[...id].delete`)).default
  const app = h3.createApp()
  const router = h3.createRouter()
  router.get('/api/_pluto/content/:type/**:id', get)
  router.patch('/api/_pluto/content/:type/**:id', patch)
  router.delete('/api/_pluto/content/:type/**:id', remove)
  app.use(router)
  const web = h3.toWebHandler(app)
  return (method: string, path: string, body?: unknown) =>
    web(
      new Request(`http://localhost${path}`, {
        method,
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    )
}

describe('content item routes', () => {
  it('passes a flat id as it is', async () => {
    const call = await handler()

    const response = await call('GET', '/api/_pluto/content/doc/hello-world')

    expect(response.status).toBe(200)
    expect(calls).toEqual([{ op: 'get', id: 'hello-world' }])
  })

  it('joins the segments of a nested id with a slash', async () => {
    const call = await handler()

    await call('GET', '/api/_pluto/content/doc/1.start/2.install')
    await call('PATCH', '/api/_pluto/content/doc/1.start/index', { title: 'T' })
    await call('DELETE', '/api/_pluto/content/doc/1.start/2.install')

    expect(calls).toEqual([
      { op: 'get', id: '1.start/2.install' },
      { op: 'update', id: '1.start/index', body: { title: 'T' } },
      { op: 'delete', id: '1.start/2.install' },
    ])
  })

  it('decodes each segment', async () => {
    const call = await handler()

    await call('GET', '/api/_pluto/content/doc/a%20b/c%2Fd')

    expect(calls[0]!.id).toBe('a b/c/d')
  })
})

describe('content revision routes', () => {
  it('pass a nested id, the revision, the limit and the cursor', async () => {
    const seen: unknown[] = []
    vi.stubGlobal('getQuery', h3.getQuery)
    vi.stubGlobal(
      'listContentRevisions',
      async (_ctx: unknown, id: string, query: unknown) => {
        seen.push({ op: 'list', id, query })
        return { supported: true, data: [] }
      }
    )
    vi.stubGlobal(
      'getContentRevision',
      async (_ctx: unknown, id: string, revision: string) => {
        seen.push({ op: 'get', id, revision })
        return { id }
      }
    )
    const list = (
      await import('../server/api/_pluto/content-revisions/[type]/[...id].get')
    ).default
    const one = (
      await import('../server/api/_pluto/content-revision/[type]/[revision]/[...id].get')
    ).default
    const app = h3.createApp()
    const router = h3.createRouter()
    router.get('/api/_pluto/content-revisions/:type/**:id', list)
    router.get('/api/_pluto/content-revision/:type/:revision/**:id', one)
    app.use(router)
    const web = h3.toWebHandler(app)

    await web(
      new Request(
        'http://localhost/api/_pluto/content-revisions/doc/1.start/2.install?limit=5&cursor=c1'
      )
    )
    await web(
      new Request('http://localhost/api/_pluto/content-revisions/doc/hello')
    )
    await web(
      new Request(
        'http://localhost/api/_pluto/content-revision/doc/abc123/1.start/index'
      )
    )

    expect(seen).toEqual([
      {
        op: 'list',
        id: '1.start/2.install',
        query: { limit: 5, cursor: 'c1' },
      },
      { op: 'list', id: 'hello', query: {} },
      { op: 'get', id: '1.start/index', revision: 'abc123' },
    ])
  })
})

describe('content backup routes', () => {
  it('pass the id query (absent: a new item) and the raw body', async () => {
    const seen: unknown[] = []
    vi.stubGlobal('getQuery', h3.getQuery)
    vi.stubGlobal('readRawBody', h3.readRawBody)
    vi.stubGlobal('getContentBackup', async (_ctx: unknown, id?: string) => {
      seen.push({ op: 'get', id })
      return { supported: true, backup: null }
    })
    vi.stubGlobal(
      'putContentBackup',
      async (_ctx: unknown, id: string | undefined, body: string) => {
        seen.push({ op: 'put', id, body })
        return { supported: true, otherDevice: false }
      }
    )
    vi.stubGlobal('removeContentBackup', async (_ctx: unknown, id?: string) => {
      seen.push({ op: 'delete', id })
      return { supported: true }
    })
    const base = '../server/api/_pluto/content-backup/[type]'
    const get = (await import(`${base}.get`)).default
    const put = (await import(`${base}.put`)).default
    const remove = (await import(`${base}.delete`)).default
    const app = h3.createApp()
    const router = h3.createRouter()
    router.get('/api/_pluto/content-backup/:type', get)
    router.put('/api/_pluto/content-backup/:type', put)
    router.delete('/api/_pluto/content-backup/:type', remove)
    app.use(router)
    const web = h3.toWebHandler(app)
    const url = 'http://localhost/api/_pluto/content-backup/doc'

    await web(new Request(`${url}?id=1.start%2F2.install`))
    await web(new Request(url))
    const putResponse = await web(
      new Request(`${url}?id=hello`, { method: 'PUT', body: '{"v":1}' })
    )
    await web(new Request(url, { method: 'PUT', body: '{}' }))
    await web(new Request(`${url}?id=hello`, { method: 'DELETE' }))
    await web(new Request(url, { method: 'DELETE' }))

    expect(await putResponse.json()).toEqual({
      supported: true,
      otherDevice: false,
    })
    expect(seen).toEqual([
      { op: 'get', id: '1.start/2.install' },
      { op: 'get', id: undefined },
      { op: 'put', id: 'hello', body: '{"v":1}' },
      { op: 'put', id: undefined, body: '{}' },
      { op: 'delete', id: 'hello' },
      { op: 'delete', id: undefined },
    ])
  })
})
