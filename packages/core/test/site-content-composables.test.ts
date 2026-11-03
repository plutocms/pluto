import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

// The composables wrap usePlutoPublicList / usePlutoPublicItem (mocked here) and Nuxt
// auto-imports (stubbed as globals).

const listCalls: Array<() => unknown> = []
const itemCalls: unknown[] = []
const itemOptions: Array<{ drafts?: () => boolean }> = []
const surroundCalls: Array<{ type: string; id: unknown; query: () => unknown }> = []
let surroundAnswer: unknown = null
const adminBar = { visible: ref(false) }
const editLink = vi.fn()
let listAnswer: unknown = null
let itemAnswer: unknown = null
let itemError: unknown = null

// Like useFetch: a promise that resolves to its own refs, with the refs on it.
function asyncData(data: unknown, error: unknown = null) {
  const refs = { data: ref(data), error: ref(error), pending: ref(false) }
  const promise = Object.assign(Promise.resolve(refs), refs)
  // Nuxt puts its own then, catch and finally on the result, as own enumerable keys.
  Object.defineProperties(promise, {
    then: { enumerable: true, value: promise.then.bind(promise) },
    catch: { enumerable: true, value: promise.catch.bind(promise) },
    finally: { enumerable: true, value: promise.finally.bind(promise) },
  })
  return promise
}

vi.mock('../app/composables/pluto-public', () => ({
  usePlutoPublicList: (_type: string, query: () => unknown) => {
    listCalls.push(query)
    return asyncData(listAnswer)
  },
  usePlutoPublicItem: (
    type: string,
    id: unknown,
    options: { drafts?: () => boolean } = {}
  ) => {
    itemCalls.push({ type, id })
    itemOptions.push(options)
    return asyncData(itemAnswer, itemError)
  },
  usePlutoPublicSurround: (type: string, id: unknown, query: () => unknown) => {
    surroundCalls.push({ type, id, query })
    return asyncData(surroundAnswer)
  },
}))

vi.mock('../app/composables/pluto-navbar', () => ({
  usePlutoAdminBar: () => adminBar,
}))

vi.mock('../app/composables/pluto-edit-link', () => ({
  usePlutoEditLink: (...args: unknown[]) => editLink(...args),
}))

const route = { query: {} as Record<string, string | undefined> }
const push = vi.fn()
const replace = vi.fn()
const seo = vi.fn()

beforeEach(() => {
  listCalls.length = 0
  itemCalls.length = 0
  itemOptions.length = 0
  surroundCalls.length = 0
  surroundAnswer = null
  adminBar.visible.value = false
  route.query = {}
  listAnswer = { data: [{ id: 1 }], meta: { total: 25, limit: 10, offset: 0 } }
  itemAnswer = null
  itemError = null
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useRouter', () => ({ push, replace }))
  vi.stubGlobal('useSeoMeta', seo)
  vi.stubGlobal('useRequestURL', () => new URL('https://blog.example.com/posts/a'))
  vi.stubGlobal('usePlutoContentTypes', () => ({
    byName: () => ({
      titleField: 'title',
      fields: [{ name: 'cover', type: 'media' }],
    }),
  }))
  vi.stubGlobal(
    'createError',
    (input: { status: number; statusText?: string }) =>
      Object.assign(new Error(input.statusText), input)
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

const { definePlutoContent, useAdjacentPosts, usePost, usePosts } = await import(
  '../app/composables/pluto-site-content'
)

describe('usePosts', () => {
  it('reads the page from the URL, sorts by publishedAt, and counts the pages', async () => {
    route.query = { page: '2' }
    const result = await usePosts({ limit: 10, search: '  hello ' })

    expect(listCalls[0]!()).toEqual({
      limit: 10,
      offset: 10,
      search: 'hello',
      sort: '-publishedAt',
    })
    expect(result.posts.value).toEqual([{ id: 1 }])
    expect(result.total.value).toBe(25)
    expect(result.page.value).toBe(2)
    expect(result.pages.value).toBe(3)
  })

  it('writes the page to the URL, with no key for page 1', () => {
    route.query = { q: 'x', page: '3' }
    const { page } = usePosts()

    page.value = 1
    expect(push).toHaveBeenLastCalledWith({ query: { q: 'x', page: undefined } })
    page.value = 4
    expect(push).toHaveBeenLastCalledWith({ query: { q: 'x', page: '4' } })
  })

  it('keeps the first page with page: false, and a given page with a number', () => {
    route.query = { page: '5' }
    usePosts({ page: false })
    usePosts({ page: 2, limit: 5 })

    expect(listCalls[0]!()).toMatchObject({ offset: 0 })
    expect(listCalls[1]!()).toMatchObject({ offset: 5, limit: 5 })
  })
})

describe('usePost', () => {
  it('gives the post, the edit link and the SEO tags', async () => {
    itemAnswer = {
      data: {
        id: 7,
        title: 'Hello',
        excerpt: 'Short',
        cover: { url: '/media/a.webp' },
      },
    }
    const { post } = await usePost('hello')

    expect(post.value).toMatchObject({ id: 7, title: 'Hello' })
    expect(itemCalls).toEqual([{ type: 'post', id: 'hello' }])
    expect(editLink.mock.calls[0]![0]).toBe('post')
    expect((editLink.mock.calls[0]![1] as () => unknown)()).toBe(7)

    const tags = seo.mock.calls[0]![0] as Record<string, unknown>
    const read = (key: string) => (tags[key] as () => unknown)()
    expect(read('title')).toBe('Hello')
    expect(read('description')).toBe('Short')
    expect(read('ogImage')).toBe('https://blog.example.com/media/a.webp')
    expect(tags.ogType).toBe('article')
  })

  it('throws a 404 for a missing post, or gives null with notFound: null', async () => {
    itemError = { status: 404, statusText: 'Not Found' }
    await expect(usePost('nope')).rejects.toMatchObject({ status: 404 })

    const { post, error } = await usePost('nope', { notFound: 'null' })
    expect(post.value).toBeNull()
    expect(error.value).toMatchObject({ status: 404 })
  })

  it('throws another failure with its own status', async () => {
    itemError = { statusCode: 502, statusText: 'Bad Gateway' }
    await expect(usePost('a')).rejects.toMatchObject({
      status: 502,
      statusText: 'Bad Gateway',
    })
  })

  it('skips the SEO tags and the edit link when asked', async () => {
    itemAnswer = { data: { id: 1, title: 'A' } }
    await usePost('a', { seo: false, editLink: false })
    expect(seo).not.toHaveBeenCalled()
    expect(editLink).not.toHaveBeenCalled()
  })
})

describe('definePlutoContent', () => {
  it('makes the composables of any type, with item and items', async () => {
    itemAnswer = { data: { id: 3, title: 'Launch' } }
    const events = definePlutoContent<{ id: number; title: string }>('event')

    const { item } = await events.useItem(3)
    const { items } = await events.useList({ page: false })

    expect(item.value).toEqual({ id: 3, title: 'Launch' })
    expect(items.value).toEqual([{ id: 1 }])
    expect(itemCalls).toEqual([{ type: 'event', id: 3 }])
    expect((seo.mock.calls[0]![0] as { ogType: string }).ogType).toBe(
      'website'
    )
    expect(listCalls[0]!()).toEqual({ limit: 20, offset: 0 })
  })
})

describe('the search of a list', () => {
  it('reads ?q= of the URL, and writes the search box to it after 300 ms, on page 1', async () => {
    vi.useFakeTimers()
    route.query = { q: 'mugs', page: '2' }
    const { search } = usePosts()

    expect(listCalls[0]!()).toMatchObject({ search: 'mugs', offset: 20 })
    expect(search.value).toBe('mugs')

    search.value = '  cups '
    await vi.advanceTimersByTimeAsync(299)
    expect(replace).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(replace).toHaveBeenCalledWith({ query: { q: 'cups', page: undefined } })
    vi.useRealTimers()
  })

  it('takes no search with search: false, and a given search with a value', () => {
    route.query = { q: 'mugs' }
    usePosts({ search: false })
    usePosts({ search: ' tea ' })

    expect(listCalls[0]!()).not.toHaveProperty('search')
    expect(listCalls[1]!()).toMatchObject({ search: 'tea' })
  })

  it('gives a link to another page', () => {
    route.query = { q: 'x', page: '3' }
    const { pageLink } = usePosts()

    expect(pageLink(1)).toEqual({ query: { q: 'x', page: undefined } })
    expect(pageLink(4)).toEqual({ query: { q: 'x', page: '4' } })
  })
})

describe('drafts', () => {
  it('asks for drafts only while the admin bar shows, unless drafts: false', async () => {
    itemAnswer = { data: { id: 2, title: 'Soon' }, meta: { draft: true } }
    const { draft } = await usePost('soon')
    usePost('soon', { drafts: false })

    expect(draft.value).toBe(true)
    expect(itemOptions[0]!.drafts!()).toBe(false)
    adminBar.visible.value = true
    expect(itemOptions[0]!.drafts!()).toBe(true)
    expect(itemOptions[1]!.drafts!()).toBe(false)
  })
})

describe('useAdjacentPosts', () => {
  it('gives the newer and the older post, in the order of the posts', async () => {
    surroundAnswer = { data: { previous: { slug: 'new' }, next: { slug: 'old' } } }
    const { newer, older } = await useAdjacentPosts('mid')

    expect(newer.value).toEqual({ slug: 'new' })
    expect(older.value).toEqual({ slug: 'old' })
    expect(surroundCalls[0]).toMatchObject({ type: 'post', id: 'mid' })
    expect(surroundCalls[0]!.query()).toEqual({ sort: '-publishedAt' })
  })

  it('is null at the ends', async () => {
    surroundAnswer = { data: { previous: null, next: null } }
    const { newer, older } = await useAdjacentPosts('only')
    expect(newer.value).toBeNull()
    expect(older.value).toBeNull()
  })
})
