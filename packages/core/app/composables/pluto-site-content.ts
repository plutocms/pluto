import type { MaybeRefOrGetter } from 'vue'
import type {
  PlutoContentDefaults,
  PlutoContentItemOptions,
  PlutoContentListOptions,
  PlutoPost,
  PlutoPostSummary,
  PlutoPublicItem,
} from '../../shared/types/public-api'
import { computed, onScopeDispose, ref, toValue, watch } from 'vue'
import { usePlutoEditLink } from './pluto-edit-link'
import { usePlutoAdminBar } from './pluto-navbar'
import {
  usePlutoPublicItem,
  usePlutoPublicList,
  usePlutoPublicSurround,
} from './pluto-public'

function errorStatus(error: unknown): number {
  const value = error as {
    status?: number
    statusCode?: number
  } | null
  return value?.status ?? value?.statusCode ?? 500
}

/**
 * Adds keys to the result of an awaitable composable (`useFetch`, `useList`, `useItem`): to the
 * object, and to what it resolves to. A layer names its keys with it:
 * `extendPlutoAsyncData(result, { products: result.items })`.
 */
export function extendPlutoAsyncData<R extends object, E extends object>(
  result: Promise<R> & R,
  extra: E
): Promise<R & E> & R & E {
  return withRefsOf(
    result.then((value) => Object.assign(value, extra)),
    result,
    extra
  )
}

/**
 * Copies the keys of `source` and `extra` onto the promise `target`, but not `then`, `catch` and
 * `finally`: Nuxt puts them on the `useFetch` result as own keys, bound to its own promise. A
 * copy would make an await of `target` wait for that promise and skip `target` itself.
 */
function withRefsOf<T extends Promise<unknown>, S extends object, E extends object>(
  target: T,
  source: S,
  extra: E = {} as E
): T & S & E {
  for (const [key, value] of Object.entries(source)) {
    if (key !== 'then' && key !== 'catch' && key !== 'finally') {
      Object.defineProperty(target, key, {
        value,
        enumerable: true,
        writable: true,
        configurable: true,
      })
    }
  }
  return Object.assign(target, extra) as T & S & E
}

/**
 * The composables of one public content type: `useList` (the published items, with pages) and
 * `useItem` (one item by id or slug, with a 404, the SEO tags and the admin bar edit link). Both
 * run on the server too, and can be awaited like `useFetch`. Core and the layers define the
 * composables of their own types with it (`usePosts`, `usePost`); an app does the same for its
 * types:
 *
 * @example
 * // app/composables/events.ts
 * export const { useList: useEvents, useItem: useEvent } = definePlutoContent<Event>('event')
 *
 * // pages/events/[slug].vue
 * const { item: event } = await useEvent(() => String(route.params.slug))
 */
export function definePlutoContent<
  TItem extends object = PlutoPublicItem,
  TSummary extends object = TItem,
>(type: string, defaults: PlutoContentDefaults = {}) {
  function useList(options: PlutoContentListOptions = {}) {
    const route = useRoute()
    const router = useRouter()
    const settings = { ...defaults.list, ...options }
    const limit = Math.min(100, Math.max(1, Math.trunc(settings.limit ?? 20)))
    const pageOption = settings.page

    const page = computed<number>({
      get: () => {
        const value =
          pageOption === false
            ? 1
            : pageOption === undefined
              ? Number(route.query.page)
              : toValue(pageOption)
        return Math.max(1, Math.trunc(value) || 1)
      },
      set: (value) => {
        if (pageOption === undefined) {
          router.push({
            query: {
              ...route.query,
              page: value > 1 ? String(Math.trunc(value)) : undefined,
            },
          })
        }
      },
    })
    const searchOption = settings.search
    const urlSearch = computed(() => String(route.query.q ?? '').trim())

    // The search box. Bound to `?q=` of the URL (the default): a change writes the URL after
    // 300 ms, on page 1, and a change of the URL (back, forward) fills the box.
    const searchInput = ref(searchOption === undefined ? urlSearch.value : '')
    if (searchOption === undefined) {
      let timer: ReturnType<typeof setTimeout> | undefined
      watch(searchInput, (value) => {
        clearTimeout(timer)
        timer = setTimeout(() => {
          const term = value.trim()
          if (term !== urlSearch.value) {
            router.replace({
              query: { ...route.query, q: term || undefined, page: undefined },
            })
          }
        }, 300)
      })
      watch(urlSearch, (value) => {
        if (value !== searchInput.value.trim()) {
          searchInput.value = value
        }
      })
      onScopeDispose(() => clearTimeout(timer))
    }
    const search = computed(() =>
      searchOption === false
        ? undefined
        : searchOption === undefined
          ? urlSearch.value || undefined
          : toValue(searchOption)?.trim() || undefined
    )

    // A new search starts on the first page.
    watch(search, () => {
      if (page.value > 1) {
        page.value = 1
      }
    })

    /** A link to page `value` of the list, for `NuxtLink` (`?page=`, no key for page 1). */
    function pageLink(value: number) {
      return {
        query: {
          ...route.query,
          page: value > 1 ? String(Math.trunc(value)) : undefined,
        },
      }
    }

    const fetch = usePlutoPublicList<TSummary>(type, () => {
      const sort = toValue(settings.sort)
      const filter = toValue(settings.filter)
      return {
        limit,
        offset: (page.value - 1) * limit,
        ...(search.value && { search: search.value }),
        ...(sort && { sort }),
        ...(filter && { filter }),
      }
    })
    const items = computed(() => fetch.data.value?.data ?? [])
    const total = computed(() => fetch.data.value?.meta.total ?? 0)
    const pages = computed(() =>
      Math.max(1, Math.ceil(total.value / limit))
    )

    return extendPlutoAsyncData(fetch, {
      items,
      total,
      page,
      pages,
      pageLink,
      search: searchInput,
    })
  }

  function useItem(
    id: MaybeRefOrGetter<string | number>,
    options: PlutoContentItemOptions = {}
  ) {
    // An editor (the admin bar shows) also gets a draft: the same page shows it before it is out.
    const adminBar = usePlutoAdminBar()
    const fetch = usePlutoPublicItem<TItem>(type, id, {
      drafts: () => options.drafts !== false && adminBar.visible.value,
    })
    const item = computed<TItem | null>(() => fetch.data.value?.data ?? null)
    const draft = computed(() => fetch.data.value?.meta?.draft === true)

    if (options.editLink !== false) {
      usePlutoEditLink(
        type,
        () => (item.value as { id?: string | number } | null)?.id
      )
    }

    if (options.seo !== false) {
      const { byName } = usePlutoContentTypes()
      const origin = useRequestURL().origin
      const fields = () => item.value as Record<string, unknown> | null
      const text = (value: unknown) =>
        typeof value === 'string' && value ? value : undefined
      const title = () =>
        text(fields()?.[byName(type)?.titleField ?? 'title'])
      const description = () =>
        text(fields()?.excerpt) ?? text(fields()?.description)
      const image = () => {
        const media = byName(type)?.fields.find(
          (field) => field.type === 'media'
        )
        const value = media ? fields()?.[media.name] : undefined
        const first = (Array.isArray(value) ? value[0] : value) as {
          url?: string
        } | null | undefined
        return first?.url ? new URL(first.url, origin).href : undefined
      }
      useSeoMeta({
        title,
        description,
        ogTitle: title,
        ogDescription: description,
        ogImage: image,
        ogType: defaults.ogType ?? 'website',
      })
    }

    const result = extendPlutoAsyncData(fetch, { item, draft })
    return withRefsOf(
      result.then((value) => {
        const error = fetch.error.value
        if (error && options.notFound !== 'null') {
          const status = errorStatus(error)
          throw createError({
            status,
            statusText: status === 404 ? 'Not found' : error.statusText,
          })
        }
        return value
      }),
      result
    )
  }

  /**
   * The published items before and after one item (`previous`, `next`), in the order of the
   * list (`defaults.list.sort`, else `sort`). Both `null` while there is none.
   */
  function useSurround(
    id: MaybeRefOrGetter<string | number>,
    options: Pick<PlutoContentListOptions, 'sort' | 'filter'> = {}
  ) {
    const fetch = usePlutoPublicSurround<TSummary>(type, id, () => {
      const sort = toValue(options.sort ?? defaults.list?.sort)
      const filter = toValue(options.filter ?? defaults.list?.filter)
      return { ...(sort && { sort }), ...(filter && { filter }) }
    })
    return extendPlutoAsyncData(fetch, {
      previous: computed(() => fetch.data.value?.data.previous ?? null),
      next: computed(() => fetch.data.value?.data.next ?? null),
    })
  }

  return { useList, useItem, useSurround }
}

const posts = definePlutoContent<PlutoPost, PlutoPostSummary>('post', {
  list: { sort: '-publishedAt' },
  ogType: 'article',
})

/**
 * The published posts, newest first, with pages (`?page=` of the URL). `posts` is the list.
 *
 * @example
 * const { posts, page, pages } = await usePosts({ limit: 10, search })
 */
export function usePosts(options: PlutoContentListOptions = {}) {
  const result = posts.useList(options)
  return extendPlutoAsyncData(result, { posts: result.items })
}

/**
 * One published post, by slug or id. A missing post shows the error page (404). It sets the
 * SEO tags and the admin bar "Edit Post". `post` is the post.
 *
 * @example
 * const { post } = await usePost(() => String(route.params.slug))
 */
export function usePost(
  slug: MaybeRefOrGetter<string | number>,
  options: PlutoContentItemOptions = {}
) {
  const result = posts.useItem(slug, options)
  return extendPlutoAsyncData(result, { post: result.item })
}

/**
 * The posts around one post, newest first: `newer` and `older` (`null` at either end).
 *
 * @example
 * const { newer, older } = await useAdjacentPosts(() => String(route.params.slug))
 */
export function useAdjacentPosts(slug: MaybeRefOrGetter<string | number>) {
  const result = posts.useSurround(slug)
  return extendPlutoAsyncData(result, {
    newer: result.previous,
    older: result.next,
  })
}
