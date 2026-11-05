import type { H3Event } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { markPublicRead } from '../../../../core/server/utils/pluto-public-read'
import { plutoSeoListEntries } from '../server/utils/seo-entries'

// `plutoSeoListEntries` uses names that Nitro auto-imports. Each test stubs them with a fake
// adapter, to check the paging and the filters without a store.

afterEach(() => {
  vi.unstubAllGlobals()
})

interface Row {
  id: string
  slug: string
  status: string
  seoNoindex?: boolean
  publishedAt?: string
  updatedAt?: string
}

function setup(
  rows: Row[],
  overrides: { type?: Record<string, unknown>; total?: boolean } = {}
) {
  const type = {
    name: 'post',
    api: { public: true },
    defaultSort: { field: 'createdAt', direction: 'desc' },
    status: { publishedValue: 'published', values: [] },
    previewUrl: (item: Row) => `/posts/${item.slug}`,
    ...overrides.type,
  }
  const calls: {
    limit: number
    offset: number
    sort: unknown
    drafts: boolean
  }[] = []
  const adapter = {
    timestampKeys: () => ({ published: 'publishedAt', updated: 'updatedAt' }),
    list: async (
      _ctx: unknown,
      query: {
        limit: number
        offset: number
        sort: unknown
        includeUnpublished: boolean
      }
    ) => {
      calls.push({
        limit: query.limit,
        offset: query.offset,
        sort: query.sort,
        drafts: query.includeUnpublished,
      })
      return {
        data: rows.slice(query.offset, query.offset + query.limit),
        ...(overrides.total !== false && { total: rows.length }),
      }
    },
  }
  vi.stubGlobal('markPublicRead', markPublicRead)
  vi.stubGlobal('getContentType', (name: string) =>
    name === 'post' ? type : undefined
  )
  vi.stubGlobal('requireContentAdapter', () => adapter)
  vi.stubGlobal(
    'parsePublicQuery',
    (_type: unknown, query: { sort?: string }) => {
      if (query.sort === '-bad') {
        throw new Error('invalid')
      }
      return { sort: { field: 'publishedAt', direction: 'desc' } }
    }
  )
  vi.stubGlobal(
    'isPublishedItem',
    (_type: unknown, item: Row) => item.status === 'published'
  )
  vi.stubGlobal('toPublicData', async (_ctx: unknown, item: Row) => ({
    id: item.id,
    title: item.slug,
  }))
  return { calls }
}

const event = { context: {} } as H3Event

function rows(
  count: number,
  extra: (index: number) => Partial<Row> = () => ({})
) {
  return Array.from({ length: count }, (_, index): Row => ({
    id: `p${index}`,
    slug: `p${index}`,
    status: 'published',
    publishedAt: `2026-01-${String((index % 28) + 1).padStart(2, '0')}T00:00:00Z`,
    ...extra(index),
  }))
}

describe('plutoSeoListEntries', () => {
  it('marks the read as public', async () => {
    setup(rows(1))
    const target = { context: {} } as H3Event
    await plutoSeoListEntries(target, 'post')
    expect(target.context.plutoPublicRead).toBe(true)
  })

  it('gives the path, the dates and the noindex flag of each item', async () => {
    setup([
      {
        id: 'a',
        slug: 'a',
        status: 'published',
        publishedAt: 'P',
        updatedAt: 'U',
      },
      { id: 'b', slug: 'b', status: 'published', seoNoindex: true },
    ])
    const entries = await plutoSeoListEntries(event, 'post')
    expect(
      entries.map(({ path, publishedAt, updatedAt, noindex }) => ({
        path,
        publishedAt,
        updatedAt,
        noindex,
      }))
    ).toEqual([
      { path: '/posts/a', publishedAt: 'P', updatedAt: 'U', noindex: false },
      {
        path: '/posts/b',
        publishedAt: undefined,
        updatedAt: undefined,
        noindex: true,
      },
    ])
  })

  it('gives [] for a missing type, a private type, and a type with no page', async () => {
    setup(rows(1))
    expect(await plutoSeoListEntries(event, 'nothing')).toEqual([])
    setup(rows(1), { type: { api: { public: false } } })
    expect(await plutoSeoListEntries(event, 'post')).toEqual([])
    setup(rows(1), { type: { previewUrl: undefined } })
    expect(await plutoSeoListEntries(event, 'post')).toEqual([])
  })

  it('asks for published items only, by pages of 100', async () => {
    const { calls } = setup(rows(250))
    const entries = await plutoSeoListEntries(event, 'post')
    expect(entries).toHaveLength(250)
    expect(calls.map((call) => [call.limit, call.offset, call.drafts])).toEqual(
      [
        [100, 0, false],
        [100, 100, false],
        [100, 200, false],
      ]
    )
  })

  it('stops at a short page when the adapter gives no total', async () => {
    const { calls } = setup(rows(130), { total: false })
    expect(await plutoSeoListEntries(event, 'post')).toHaveLength(130)
    expect(calls).toHaveLength(2)
  })

  it('stops at the limit, and does not read more pages than it needs', async () => {
    const { calls } = setup(rows(250))
    const entries = await plutoSeoListEntries(event, 'post', { limit: 120 })
    expect(entries).toHaveLength(120)
    expect(calls).toHaveLength(2)
  })

  it('leaves out an item that an adapter gives as a draft', async () => {
    setup([
      { id: 'a', slug: 'a', status: 'draft' },
      { id: 'b', slug: 'b', status: 'published' },
    ])
    expect(
      (await plutoSeoListEntries(event, 'post')).map((e) => e.path)
    ).toEqual(['/posts/b'])
  })

  it('leaves out an item with no page', async () => {
    setup(rows(3), {
      type: {
        previewUrl: (item: Row) => (item.id === 'p1' ? undefined : '/x'),
      },
    })
    expect(await plutoSeoListEntries(event, 'post')).toHaveLength(2)
  })

  it('skips noindex items, and they do not count for the limit', async () => {
    setup(rows(10, (index) => ({ seoNoindex: index % 2 === 0 })))
    const entries = await plutoSeoListEntries(event, 'post', {
      skipNoindex: true,
      limit: 3,
    })
    expect(entries.map((entry) => entry.path)).toEqual([
      '/posts/p1',
      '/posts/p3',
      '/posts/p5',
    ])
  })

  it('sorts by the public sort that it is given, and by the type sort when the field is bad', async () => {
    const { calls } = setup(rows(1))
    await plutoSeoListEntries(event, 'post', { sort: '-publishedAt' })
    await plutoSeoListEntries(event, 'post', { sort: '-bad' })
    await plutoSeoListEntries(event, 'post')
    expect(calls.map((call) => call.sort)).toEqual([
      { field: 'publishedAt', direction: 'desc' },
      { field: 'createdAt', direction: 'desc' },
      { field: 'createdAt', direction: 'desc' },
    ])
  })

  it('adds the public data with withData only', async () => {
    setup(rows(2))
    const plain = await plutoSeoListEntries(event, 'post')
    expect(plain[0]?.data).toBeUndefined()
    const withData = await plutoSeoListEntries(event, 'post', {
      withData: true,
    })
    expect(withData[0]?.data).toEqual({ id: 'p0', title: 'p0' })
  })
})
