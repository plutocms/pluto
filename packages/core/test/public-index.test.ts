import type { H3Event } from 'h3'
import type {
  PlutoContentAdapter,
  PlutoContentItem,
  PlutoContentType,
} from '../shared/types/content'
import type { PlutoPublicIndexType } from '../shared/types/public-api'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { plutoPublicQueryParams } from '../shared/utils/public-api'
import { queryPublicIndex } from '../shared/utils/public-index'

vi.mock('../server/utils/pluto-api-config', () => ({
  getPlutoApiConfig: () => ({ cors: true, maxAge: 60 }),
}))

// The registry is a module-scope singleton: each test loads a fresh copy.
afterEach(() => {
  vi.resetModules()
})

const entry: PlutoPublicIndexType = {
  titleField: 'title',
  items: [
    {
      id: 'c',
      title: 'Coffee at dawn',
      tag: 'food',
      publishedAt: '2026-03-03',
    },
    {
      id: 'b',
      title: 'Bread and butter',
      tag: 'food',
      publishedAt: '2026-02-02',
    },
    { id: 'a', title: 'A walk by the sea', tag: 'walks' },
  ],
}

const ids = (list: { data: { id: string | number }[] }) =>
  list.data.map((item) => item.id)

describe('queryPublicIndex', () => {
  it('keeps the order of the index, with the default limit', () => {
    const list = queryPublicIndex(entry)
    expect(ids(list)).toEqual(['c', 'b', 'a'])
    expect(list.meta).toEqual({ total: 3, limit: 20, offset: 0 })
  })

  it('searches the title without case', () => {
    const list = queryPublicIndex(
      entry,
      plutoPublicQueryParams({ search: 'BREAD' })
    )
    expect(ids(list)).toEqual(['b'])
    expect(list.meta.total).toBe(1)
  })

  it('filters on the text of a value', () => {
    const list = queryPublicIndex(
      entry,
      plutoPublicQueryParams({ filter: { tag: 'food' } })
    )
    expect(ids(list)).toEqual(['c', 'b'])
  })

  it('filters an expanded relation by its id', () => {
    const shop: PlutoPublicIndexType = {
      titleField: 'name',
      items: [
        { id: 1, name: 'Mug', category: { id: 3, label: 'Kitchen' } },
        { id: 2, name: 'Lamp', category: { id: 4, label: 'Home' } },
        { id: 3, name: 'Plate', category: null },
      ],
    }
    expect(
      ids(
        queryPublicIndex(
          shop,
          plutoPublicQueryParams({ filter: { category: 3 } })
        )
      )
    ).toEqual([1])
  })

  it('filters a list of references by id or slug', () => {
    const blog: PlutoPublicIndexType = {
      titleField: 'title',
      items: [
        {
          id: 'p1',
          title: 'One',
          tags: [
            { id: 'a', label: 'A', slug: 'alpha' },
            { id: 'b', label: 'B', slug: 'beta' },
          ],
        },
        {
          id: 'p2',
          title: 'Two',
          tags: [{ id: 'b', label: 'B', slug: 'beta' }],
        },
        { id: 'p3', title: 'Three', tags: [] },
        { id: 'p4', title: 'Four' },
        { id: 'p5', title: 'Five', plain: ['x', 'y'] },
      ],
    }
    const run = (filter: Record<string, string>) =>
      ids(queryPublicIndex(blog, plutoPublicQueryParams({ filter })))
    expect(run({ tags: 'a' })).toEqual(['p1'])
    expect(run({ tags: 'alpha' })).toEqual(['p1'])
    expect(run({ tags: 'beta' })).toEqual(['p1', 'p2'])
    expect(run({ tags: 'nope' })).toEqual([])
    expect(run({ plain: 'y' })).toEqual(['p5'])
  })

  it('sorts, with a missing value last in both directions', () => {
    expect(ids(queryPublicIndex(entry, { sort: 'publishedAt' }))).toEqual([
      'b',
      'c',
      'a',
    ])
    expect(ids(queryPublicIndex(entry, { sort: '-publishedAt' }))).toEqual([
      'c',
      'b',
      'a',
    ])
    expect(ids(queryPublicIndex(entry, { sort: 'title' }))).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('pages with limit and offset, and counts the total before them', () => {
    const list = queryPublicIndex(entry, { limit: '2', offset: '2' })
    expect(ids(list)).toEqual(['a'])
    expect(list.meta).toEqual({ total: 3, limit: 2, offset: 2 })
  })

  it('keeps the limit between 1 and 100', () => {
    expect(queryPublicIndex(entry, { limit: '0' }).meta.limit).toBe(1)
    expect(queryPublicIndex(entry, { limit: '500' }).meta.limit).toBe(100)
    expect(queryPublicIndex(entry, { limit: 'x' }).meta.limit).toBe(20)
  })

  it('does not change the index', () => {
    queryPublicIndex(entry, { sort: 'title' })
    expect(ids(queryPublicIndex(entry))).toEqual(['c', 'b', 'a'])
  })
})

describe('buildPublicIndex', () => {
  const event = () =>
    ({
      context: {},
      node: { res: { setHeader: () => {}, getHeader: () => undefined } },
    }) as unknown as H3Event

  const type = (name: string, extra: Partial<PlutoContentType> = {}) =>
    ({
      name,
      label: name,
      labelPlural: name,
      source: name,
      titleField: 'title',
      fields: [{ name: 'title', type: 'text', label: 'Title' }],
      api: { public: true },
      ...extra,
    }) as PlutoContentType

  // 150 items: more than one page of the API (100).
  const rows: PlutoContentItem[] = Array.from({ length: 150 }, (_, index) => ({
    id: index + 1,
    title: `Post ${index + 1}`,
    secret: 'x',
  }))

  const adapter: PlutoContentAdapter = {
    id: 'rows',
    async list(_ctx, query) {
      const offset = query.offset ?? 0
      return {
        data: rows.slice(offset, offset + (query.limit ?? rows.length)),
        total: rows.length,
      }
    },
    async get() {
      return null
    },
    async create() {
      throw new Error('no')
    },
    async update() {
      throw new Error('no')
    },
    async remove() {},
  }

  it('holds every item of every public type, in the public shape', async () => {
    const registry = await import('../server/utils/pluto-content')
    const api = await import('../server/utils/pluto-public-api')
    registry.registerContentType(type('post'))
    registry.registerContentType(type('note', { api: undefined }))
    registry.registerContentAdapter(adapter)

    const index = await api.buildPublicIndex(event())

    expect(Object.keys(index.types)).toEqual(['post'])
    expect(index.types.post?.titleField).toBe('title')
    expect(index.types.post?.items).toHaveLength(150)
    expect(index.types.post?.items[149]).toEqual({ id: 150, title: 'Post 150' })
  })
})
