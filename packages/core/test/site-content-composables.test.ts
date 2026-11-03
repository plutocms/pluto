import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

// The composables wrap usePlutoPublicList / usePlutoPublicItem (mocked here) and Nuxt
// auto-imports (stubbed as globals).

const listCalls: Array<() => unknown> = []
const itemCalls: unknown[] = []
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
  usePlutoPublicItem: (type: string, id: unknown) => {
    itemCalls.push({ type, id })
    return asyncData(itemAnswer, itemError)
  },
}))

vi.mock('../app/composables/pluto-edit-link', () => ({
  usePlutoEditLink: (...args: unknown[]) => editLink(...args),
}))

const route = { query: {} as Record<string, string | undefined> }
const push = vi.fn()
const seo = vi.fn()

beforeEach(() => {
  listCalls.length = 0
  itemCalls.length = 0
  route.query = {}
  listAnswer = { data: [{ id: 1 }], meta: { total: 25, limit: 10, offset: 0 } }
  itemAnswer = null
  itemError = null
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useRouter', () => ({ push }))
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

const { definePlutoContent, usePost, usePosts } = await import(
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
