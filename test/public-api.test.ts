import type { H3Event } from 'h3'
import type { PlutoContentAdapter, PlutoContentItem, PlutoContentType } from '../shared/types/content'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isPlutoApiPath, plutoApiCorsHeaders } from '../server/utils/pluto-api-cors'
import { resolvePlutoApiConfig } from '../server/utils/pluto-api-options'
import { PLUTO_API_PREFIX, plutoContentApiPath, plutoPublicQueryParams } from '../shared/utils/public-api'

vi.mock('../server/utils/pluto-api-config', () => ({ getPlutoApiConfig: () => ({ cors: true, maxAge: 60 }) }))

// The registry is a module-scope singleton: each test loads a fresh copy.
afterEach(() => {
  vi.resetModules()
})

function event(): H3Event {
  return { context: {}, node: { res: { setHeader: () => {}, getHeader: () => undefined } } } as unknown as H3Event
}

function postType(overrides: Partial<PlutoContentType> = {}): PlutoContentType {
  return {
    name: 'post',
    label: 'Post',
    labelPlural: 'Posts',
    source: 'posts',
    titleField: 'title',
    fields: [
      { name: 'title', type: 'text', label: 'Title' },
      { name: 'slug', type: 'slug', label: 'Slug' },
      { name: 'notes', type: 'text', label: 'Notes' },
      { name: 'upload', type: 'text', label: 'Upload', virtual: true },
    ],
    status: { values: [{ label: 'Draft', value: 'draft' }, { label: 'Published', value: 'published' }], publishedValue: 'published' },
    api: { public: true },
    ...overrides,
  }
}

const ROWS: PlutoContentItem[] = [
  { id: 1, title: 'One', slug: 'one', notes: 'a', status: 'published', created_at: '2026-01-01', secret_column: 'x', _version: 'v1' },
  { id: 2, title: 'Two', slug: 'two', notes: 'b', status: 'draft', created_at: '2026-01-02' },
]

/** An adapter that returns every row, drafts too: the public API must still hide drafts. */
function leakyAdapter(extra: Partial<PlutoContentAdapter> = {}): PlutoContentAdapter & {
  queries: unknown[]
} {
  const queries: unknown[] = []
  return {
    id: 'leaky',
    queries,
    async list(_ctx, query) {
      queries.push(query)
      return { data: ROWS, total: ROWS.length }
    },
    async get(_ctx, id) {
      return ROWS.find((row) => String(row.id) === String(id) || row.slug === id) ?? null
    },
    async create() {
      throw new Error('no')
    },
    async update() {
      throw new Error('no')
    },
    async remove() {},
    timestampKeys: () => ({ created: 'created_at' }),
    ...extra,
  }
}

async function load(type: PlutoContentType, adapter: PlutoContentAdapter) {
  const registry = await import('../server/utils/pluto-content')
  const api = await import('../server/utils/pluto-public-api')
  registry.registerContentType(type)
  registry.registerContentAdapter(adapter)
  return api
}

describe('requirePublicType', () => {
  it('answers 404 for an unknown type and for a type that did not opt in', async () => {
    const api = await load(postType({ name: 'page', api: undefined }), leakyAdapter())

    expect(() => api.requirePublicType('nope')).toThrow(expect.objectContaining({ statusCode: 404 }))
    expect(() => api.requirePublicType('page')).toThrow(expect.objectContaining({ statusCode: 404 }))
  })
})

describe('parsePublicQuery', () => {
  it('reads paging with defaults and bounds', async () => {
    const api = await load(postType(), leakyAdapter())
    const type = postType()

    expect(api.parsePublicQuery(type, {})).toEqual({ limit: 20, offset: 0 })
    expect(api.parsePublicQuery(type, { limit: '5', offset: '10' })).toMatchObject({ limit: 5, offset: 10 })
    expect(api.parsePublicQuery(type, { limit: '999' }).limit).toBe(100)
    expect(api.parsePublicQuery(type, { limit: '0' }).limit).toBe(1)
    expect(api.parsePublicQuery(type, { limit: '1e3', offset: '-1' })).toMatchObject({ limit: 20, offset: 0 })
  })

  it('reads sort, search and filters on public fields', async () => {
    const api = await load(postType(), leakyAdapter())
    const type = postType()

    expect(api.parsePublicQuery(type, { 'sort': '-title', 'search': '  hi  ', 'filter[slug]': 'one' })).toEqual({
      limit: 20,
      offset: 0,
      search: 'hi',
      sort: { field: 'title', direction: 'desc' },
      filters: { slug: 'one' },
    })
    expect(api.parsePublicQuery(type, { sort: 'createdAt' }).sort).toEqual({ field: 'created_at', direction: 'asc' })
    expect(api.parsePublicQuery(type, { search: 'x'.repeat(500) }).search).toHaveLength(200)
  })

  it('answers 400 for a field that the public answer does not have', async () => {
    const api = await load(postType({ api: { public: true, fields: ['title'] } }), leakyAdapter())
    const type = postType({ api: { public: true, fields: ['title'] } })

    for (const query of [{ sort: 'notes' }, { sort: 'secret_column' }, { sort: 'publishedAt' }, { 'filter[notes]': 'a' }, { 'filter[upload]': 'a' }, { 'filter[status]': 'draft' }]) {
      expect(() => api.parsePublicQuery(type, query), JSON.stringify(query)).toThrow(expect.objectContaining({ statusCode: 400 }))
    }
  })
})

describe('the public answer', () => {
  it('keeps id, the public fields and the timestamps only', async () => {
    const api = await load(postType(), leakyAdapter())

    const data = await api.toPublicData({ event: event(), type: postType() }, ROWS[0]!, 'item')

    expect(data).toEqual({ id: 1, title: 'One', slug: 'one', notes: 'a', createdAt: '2026-01-01' })
  })

  it('follows api.fields', async () => {
    const type = postType({ api: { public: true, fields: ['title', 'upload', 'missing'] } })
    const api = await load(type, leakyAdapter())

    expect(await api.toPublicData({ event: event(), type }, ROWS[0]!, 'list')).toEqual({ id: 1, title: 'One', createdAt: '2026-01-01' })
  })

  it('runs adapter.toPublic, then hooks.toPublic', async () => {
    const calls: string[] = []
    const type = postType({
      hooks: {
        toPublic: (_ctx, data, info) => {
          calls.push(`hook:${info.view}:${String(data.fromAdapter)}:${info.batch.length}`)
          return { ...data, fromHook: info.item.secret_column }
        },
      },
    })
    const api = await load(type, leakyAdapter({
      toPublic: (_ctx, data) => {
        calls.push('adapter')
        return { ...data, fromAdapter: true }
      },
    }))

    const data = await api.toPublicData({ event: event(), type }, ROWS[0]!, 'list', ROWS)

    expect(calls).toEqual(['adapter', 'hook:list:true:2'])
    expect(data).toMatchObject({ fromAdapter: true, fromHook: 'x' })
  })
})

describe('listPublicContent and getPublicContent', () => {
  it('asks the adapter for published items, and drops a draft that it still returns', async () => {
    const adapter = leakyAdapter()
    const api = await load(postType(), adapter)
    const ev = event()

    const result = await api.listPublicContent(ev, 'post', { 'filter[slug]': 'one', 'sort': '-createdAt' })

    expect(result.data.map((item) => item.id)).toEqual([1])
    expect(adapter.queries[0]).toMatchObject({ includeUnpublished: false, filters: { slug: 'one' }, sort: { field: 'created_at', direction: 'desc' } })
    expect(ev.context.plutoPublicRead).toBe(true)
  })

  it('answers 404 for a draft that the adapter returns', async () => {
    const api = await load(postType(), leakyAdapter())

    await expect(api.getPublicContent(event(), 'post', 'two')).rejects.toMatchObject({ statusCode: 404 })
    await expect(api.getPublicContent(event(), 'post', '')).rejects.toMatchObject({ statusCode: 404 })
    expect((await api.getPublicContent(event(), 'post', 'one')).data).toMatchObject({ id: 1, title: 'One' })
  })

  it('serves every item of a type with no publish workflow', async () => {
    const type = postType({ status: false })
    const api = await load(type, leakyAdapter())

    expect((await api.getPublicContent(event(), 'post', 'two')).data).toMatchObject({ id: 2 })
  })
})

describe('config and CORS', () => {
  it('resolves the config with defaults', () => {
    expect(resolvePlutoApiConfig(undefined)).toEqual({ cors: true, maxAge: 60 })
    expect(resolvePlutoApiConfig({ cors: 'false', maxAge: '0' })).toEqual({ cors: false, maxAge: 0 })
    expect(resolvePlutoApiConfig({ cors: ['https://a.dev', 3, ''], maxAge: -1 })).toEqual({ cors: ['https://a.dev'], maxAge: 60 })
  })

  it('matches the public API paths only', () => {
    expect(isPlutoApiPath('/api/pluto/v1/content/post?limit=1')).toBe(true)
    expect(isPlutoApiPath(PLUTO_API_PREFIX)).toBe(true)
    expect(isPlutoApiPath('/api/_pluto/content/post')).toBe(false)
    expect(isPlutoApiPath('/api/pluto/v10/x')).toBe(false)
  })

  it('allows any origin, a list of origins, or none, and never credentials', () => {
    expect(plutoApiCorsHeaders('https://x.dev', true)['Access-Control-Allow-Origin']).toBe('*')
    expect(plutoApiCorsHeaders('https://a.dev', ['https://a.dev'])).toMatchObject({ 'Access-Control-Allow-Origin': 'https://a.dev', 'Vary': 'Origin' })
    expect(plutoApiCorsHeaders('https://x.dev', ['https://a.dev'])).not.toHaveProperty('Access-Control-Allow-Origin')
    expect(plutoApiCorsHeaders('https://x.dev', false)).toEqual({})
    expect(plutoApiCorsHeaders('https://x.dev', [])).toEqual({})
    expect(plutoApiCorsHeaders('https://x.dev', true)).not.toHaveProperty('Access-Control-Allow-Credentials')
  })
})

describe('shared URL helpers', () => {
  it('builds the paths, and keeps the slashes of a nested id', () => {
    expect(plutoContentApiPath('post')).toBe('/api/pluto/v1/content/post')
    expect(plutoContentApiPath('post', 'hello world')).toBe('/api/pluto/v1/content/post/hello%20world')
    expect(plutoContentApiPath('doc', '1.start/2.install')).toBe('/api/pluto/v1/content/doc/1.start/2.install')
  })

  it('builds the query, with filter[field] keys', () => {
    expect(plutoPublicQueryParams({ limit: 5, offset: 0, sort: '-publishedAt', search: 'hi', filter: { category: 3, featured: true } })).toEqual({
      'limit': '5',
      'offset': '0',
      'sort': '-publishedAt',
      'search': 'hi',
      'filter[category]': '3',
      'filter[featured]': 'true',
    })
  })
})
