import type { H3Event } from 'h3'
import type {
  PlutoContentAdapter,
  PlutoContentItem,
  PlutoContentType,
} from '../shared/types/content'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../server/utils/pluto-api-config', () => ({
  getPlutoApiConfig: () => ({ cors: true, maxAge: 60 }),
}))

// The registry is a module-scope singleton: each test loads a fresh copy.
afterEach(() => {
  vi.resetModules()
})

function event(): H3Event {
  return {
    context: {},
    node: { res: { setHeader: () => {}, getHeader: () => undefined } },
  } as unknown as H3Event
}

const STATUS = {
  values: [
    { label: 'Draft', value: 'draft' },
    { label: 'Published', value: 'published' },
  ],
  publishedValue: 'published',
}

function tagType(overrides: Partial<PlutoContentType> = {}): PlutoContentType {
  return {
    name: 'tag',
    label: 'Tag',
    labelPlural: 'Tags',
    source: 'tags',
    titleField: 'title',
    fields: [
      { name: 'title', type: 'text', label: 'Name' },
      { name: 'slug', type: 'slug', label: 'Slug' },
    ],
    slug: { field: 'slug' },
    api: { public: true },
    ...overrides,
  }
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
      {
        name: 'tags',
        type: 'reference',
        label: 'Tags',
        target: 'tag',
        multiple: true,
      },
      { name: 'main', type: 'reference', label: 'Main', target: 'tag' },
      {
        name: 'groups',
        type: 'reference',
        label: 'Groups',
        target: 'group',
        multiple: true,
      },
    ],
    slug: { field: 'slug' },
    api: { public: true },
    ...overrides,
  }
}

const TAGS: PlutoContentItem[] = [
  { id: 'a', title: 'Alpha', slug: 'alpha' },
  { id: 'b', title: 'Beta', slug: 'beta' },
  { id: 'c', title: 'Gamma', slug: 'gamma' },
]

/** One adapter for several types. It counts the `list` reads per type and keeps `ids` and `filters`. */
function multiAdapter(rows: Record<string, PlutoContentItem[]>) {
  const lists: Array<{ type: string; ids?: Array<string | number> }> = []
  const adapter: PlutoContentAdapter = {
    id: 'multi',
    async list(ctx, query) {
      lists.push({ type: ctx.type.name, ids: query.ids })
      let data = rows[ctx.type.name] ?? []
      if (query.ids) {
        const wanted = new Set(query.ids.map(String))
        data = data.filter((row) => wanted.has(String(row.id)))
      }
      for (const [name, value] of Object.entries(query.filters ?? {})) {
        data = data.filter((row) => {
          const stored = row[name]
          return Array.isArray(stored)
            ? stored.map(String).includes(value)
            : String(stored) === value
        })
      }
      return { data, total: data.length }
    },
    async get(ctx, id) {
      return (
        (rows[ctx.type.name] ?? []).find(
          (row) => String(row.id) === String(id) || row.slug === id
        ) ?? null
      )
    },
    async create() {
      throw new Error('no')
    },
    async update() {
      throw new Error('no')
    },
    async remove() {},
  }
  return { adapter, lists }
}

async function load(types: PlutoContentType[], adapter: PlutoContentAdapter) {
  const registry = await import('../server/utils/pluto-content')
  const api = await import('../server/utils/pluto-public-api')
  for (const type of types) {
    registry.registerContentType(type)
  }
  registry.registerContentAdapter(adapter)
  return api
}

describe('expandPublicReferences through the public API', () => {
  it('reads each target once for a list of 20 posts', async () => {
    const posts = Array.from({ length: 20 }, (_, index) => ({
      id: `p${index}`,
      title: `Post ${index}`,
      slug: `post-${index}`,
      tags: index % 2 ? ['a', 'b'] : ['c'],
      main: 'a',
    }))
    const { adapter, lists } = multiAdapter({ post: posts, tag: TAGS })
    const api = await load([postType(), tagType()], adapter)

    const result = await api.listPublicContent(event(), 'post', {})

    expect(result.data).toHaveLength(20)
    expect(lists.filter((entry) => entry.type === 'tag')).toHaveLength(1)
    expect(lists.find((entry) => entry.type === 'tag')?.ids).toEqual(
      expect.arrayContaining(['a', 'b', 'c'])
    )
    expect(result.data[1]?.tags).toEqual([
      { id: 'a', label: 'Alpha', slug: 'alpha' },
      { id: 'b', label: 'Beta', slug: 'beta' },
    ])
    expect(result.data[0]?.tags).toEqual([
      { id: 'c', label: 'Gamma', slug: 'gamma' },
    ])
    expect(result.data[0]?.main).toEqual({
      id: 'a',
      label: 'Alpha',
      slug: 'alpha',
    })
  })

  it('drops an id with no item, and gives [] or null when the value is missing', async () => {
    const { adapter } = multiAdapter({
      post: [
        {
          id: 'p1',
          title: 'One',
          slug: 'one',
          tags: ['a', 'gone'],
          main: 'gone',
        },
        { id: 'p2', title: 'Two', slug: 'two' },
      ],
      tag: TAGS,
    })
    const api = await load([postType(), tagType()], adapter)

    const result = await api.listPublicContent(event(), 'post', {})

    expect(result.data[0]?.tags).toEqual([
      { id: 'a', label: 'Alpha', slug: 'alpha' },
    ])
    expect(result.data[0]?.main).toBeNull()
    expect(result.data[1]?.tags).toEqual([])
    expect(result.data[1]?.main).toBeNull()
  })

  it('keeps the ids of a private target', async () => {
    const { adapter, lists } = multiAdapter({
      post: [{ id: 'p1', title: 'One', slug: 'one', groups: ['g1', 'g2'] }],
      group: [{ id: 'g1', title: 'G' }],
    })
    const group = tagType({ name: 'group', source: 'groups', api: undefined })
    const api = await load([postType(), tagType(), group], adapter)

    const result = await api.listPublicContent(event(), 'post', {})

    expect(result.data[0]?.groups).toEqual(['g1', 'g2'])
    expect(lists.some((entry) => entry.type === 'group')).toBe(false)
  })

  it('leaves the ids when the target is not registered', async () => {
    const { adapter } = multiAdapter({
      post: [{ id: 'p1', title: 'One', slug: 'one', tags: ['a'] }],
    })
    const api = await load([postType()], adapter)
    const result = await api.listPublicContent(event(), 'post', {})
    expect(result.data[0]?.tags).toEqual(['a'])
  })

  it('expands in the item view, and gives no slug when the target has none', async () => {
    const noSlug = tagType({
      fields: [{ name: 'title', type: 'text', label: 'Name' }],
      slug: undefined,
    })
    const { adapter } = multiAdapter({
      post: [{ id: 'p1', title: 'One', slug: 'one', tags: ['a'], main: 'b' }],
      tag: TAGS,
    })
    const api = await load([postType(), noSlug], adapter)

    const one = await api.getPublicContent(event(), 'post', 'one')

    expect(one.data.tags).toEqual([{ id: 'a', label: 'Alpha' }])
    expect(one.data.main).toEqual({ id: 'b', label: 'Beta' })
  })

  it('drops a draft term', async () => {
    const withStatus = tagType({ status: STATUS })
    const { adapter } = multiAdapter({
      post: [{ id: 'p1', title: 'One', slug: 'one', tags: ['a', 'b'] }],
      tag: [
        { id: 'a', title: 'Alpha', slug: 'alpha', status: 'published' },
        { id: 'b', title: 'Beta', slug: 'beta', status: 'draft' },
      ],
    })
    const api = await load([postType(), withStatus], adapter)

    const one = await api.getPublicContent(event(), 'post', 'one')

    expect(one.data.tags).toEqual([{ id: 'a', label: 'Alpha', slug: 'alpha' }])
  })

  it('works with an adapter that ignores ids', async () => {
    const { adapter } = multiAdapter({
      post: [{ id: 'p1', title: 'One', slug: 'one', tags: ['a'] }],
      tag: TAGS,
    })
    const ignoring: PlutoContentAdapter = {
      ...adapter,
      async list(ctx, query) {
        return adapter.list(ctx, { ...query, ids: undefined })
      },
    }
    const api = await load([postType(), tagType()], ignoring)
    const one = await api.getPublicContent(event(), 'post', 'one')
    expect(one.data.tags).toEqual([{ id: 'a', label: 'Alpha', slug: 'alpha' }])
  })

  it('leaves out a field that api.fields hides', async () => {
    const { adapter } = multiAdapter({
      post: [{ id: 'p1', title: 'One', slug: 'one', tags: ['a'] }],
      tag: TAGS,
    })
    const api = await load(
      [
        postType({ api: { public: true, fields: ['title', 'slug'] } }),
        tagType(),
      ],
      adapter
    )
    const one = await api.getPublicContent(event(), 'post', 'one')
    expect(one.data).not.toHaveProperty('tags')
  })
})

describe('resolveReferenceFilters through the public API', () => {
  const posts = [
    { id: 'p1', title: 'One', slug: 'one', tags: ['a', 'b'] },
    { id: 'p2', title: 'Two', slug: 'two', tags: ['b'] },
    { id: 'p3', title: 'Three', slug: 'three' },
  ]

  it('turns a slug into the id', async () => {
    const { adapter } = multiAdapter({ post: posts, tag: TAGS })
    const api = await load([postType(), tagType()], adapter)

    const bySlug = await api.listPublicContent(event(), 'post', {
      'filter[tags]': 'beta',
    })
    expect(bySlug.data.map((item) => item.id)).toEqual(['p1', 'p2'])
    expect(bySlug.meta.total).toBe(2)

    const byId = await api.listPublicContent(event(), 'post', {
      'filter[tags]': 'a',
    })
    expect(byId.data.map((item) => item.id)).toEqual(['p1'])
  })

  it('gives an empty list for an unknown or draft term, without reading posts', async () => {
    const withStatus = tagType({ status: STATUS })
    const { adapter, lists } = multiAdapter({
      post: posts,
      tag: [{ id: 'z', title: 'Zed', slug: 'zed', status: 'draft' }],
    })
    const api = await load([postType(), withStatus], adapter)

    for (const value of ['nope', 'zed']) {
      const result = await api.listPublicContent(event(), 'post', {
        'filter[tags]': value,
      })
      expect(result.data).toEqual([])
      expect(result.meta).toEqual({ total: 0, limit: 20, offset: 0 })
    }
    expect(lists.some((entry) => entry.type === 'post')).toBe(false)
  })

  it('does not touch a filter on another field', async () => {
    const { adapter, lists } = multiAdapter({ post: posts, tag: TAGS })
    const api = await load([postType(), tagType()], adapter)
    await api.listPublicContent(event(), 'post', { 'filter[title]': 'One' })
    expect(lists.find((entry) => entry.type === 'post')).toBeDefined()
  })

  it('answers 404 in the surround route for an unknown term', async () => {
    const { adapter } = multiAdapter({ post: posts, tag: TAGS })
    const api = await load([postType(), tagType()], adapter)

    const found = await api.getPublicSurround(event(), 'post', 'two', {
      'filter[tags]': 'beta',
    })
    expect(found.data.previous).toMatchObject({ id: 'p1' })

    await expect(
      api.getPublicSurround(event(), 'post', 'two', { 'filter[tags]': 'nope' })
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('publicFields', () => {
  function authorType(): PlutoContentType {
    return {
      name: 'author',
      label: 'Author',
      labelPlural: 'Authors',
      source: 'authors',
      titleField: 'name',
      fields: [
        { name: 'name', type: 'text', label: 'Name' },
        { name: 'slug', type: 'slug', label: 'Slug' },
        { name: 'bio', type: 'textarea', label: 'Bio' },
        { name: 'avatar', type: 'media', label: 'Avatar' },
        { name: 'note', type: 'text', label: 'Note' },
      ],
      slug: { field: 'slug' },
      // `note` is not public.
      api: { public: true, fields: ['name', 'slug', 'bio', 'avatar'] },
    }
  }

  function postWithAuthors(publicFields?: string[]): PlutoContentType {
    return postType({
      fields: [
        { name: 'title', type: 'text', label: 'Title' },
        { name: 'slug', type: 'slug', label: 'Slug' },
        {
          name: 'authors',
          type: 'reference',
          label: 'Authors',
          target: 'author',
          multiple: true,
          ...(publicFields && { publicFields }),
        },
      ],
    })
  }

  const AUTHORS: PlutoContentItem[] = [
    {
      id: 1,
      name: 'Ana',
      slug: 'ana',
      bio: 'Writes.',
      avatar: 'm1',
      note: 'x',
    },
    { id: 2, name: 'Bo', slug: 'bo', bio: null, avatar: 'gone', note: 'y' },
    { id: 3, name: 'Cy', slug: 'cy', note: 'z' },
  ]

  async function setup(publicFields?: string[]) {
    const posts = Array.from({ length: 20 }, (_, index) => ({
      id: `p${index}`,
      title: `Post ${index}`,
      slug: `post-${index}`,
      authors: index % 2 ? [2, 1] : [3],
    }))
    const { adapter, lists } = multiAdapter({ post: posts, author: AUTHORS })
    const mediaModule = await import('../server/utils/pluto-media-driver')
    const get = vi.fn(async (_event: H3Event, ids: string[]) =>
      ids
        .filter((id) => id !== 'gone')
        .map((id) => ({ id, url: `/media/${id}.png`, alt: '' }))
    )
    mediaModule.registerMediaDriver({ get } as never)
    const api = await load(
      [postWithAuthors(publicFields), authorType()],
      adapter
    )
    return { api, lists, get }
  }

  it('adds the public fields of the target, with one list and one media read', async () => {
    const { api, lists, get } = await setup(['avatar', 'bio', 'note', 'id'])

    const result = await api.listPublicContent(event(), 'post', {})

    expect(lists.filter((entry) => entry.type === 'author')).toHaveLength(1)
    expect(get).toHaveBeenCalledTimes(1)
    // The order of the list stays. `note` is private and `id` is a reference key: both skipped.
    expect(result.data[1]?.authors).toEqual([
      { id: 2, label: 'Bo', slug: 'bo', avatar: null, bio: null },
      {
        id: 1,
        label: 'Ana',
        slug: 'ana',
        avatar: { id: 'm1', url: '/media/m1.png', alt: '' },
        bio: 'Writes.',
      },
    ])
    expect(result.data[0]?.authors).toEqual([
      { id: 3, label: 'Cy', slug: 'cy', avatar: null, bio: null },
    ])
  })

  it('keeps { id, label, slug } with no publicFields, and reads no media', async () => {
    const { api, get } = await setup()

    const result = await api.listPublicContent(event(), 'post', {})

    expect(get).not.toHaveBeenCalled()
    expect(result.data[1]?.authors).toEqual([
      { id: 2, label: 'Bo', slug: 'bo' },
      { id: 1, label: 'Ana', slug: 'ana' },
    ])
  })
})
