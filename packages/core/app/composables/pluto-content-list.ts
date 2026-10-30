export interface PlutoContentListOptions {
  /**
   * Rows per request. Set it to load the list page by page: the first page
   * on creation, the next pages through `loadMore()`. Leave it unset for one
   * request that returns every row (an adapter can cap that request; the
   * Supabase adapter returns at most 1000 rows).
   */
  pageSize?: number
}

/**
 * Fetches one content type's list of items, for the generic list page
 * (`PlutoContentList`).
 *
 * This is one half of the split that replaces the old `usePost`/`useProduct`
 * pattern (see `usePlutoContentItem` for the other half). That old pattern
 * fetched a list AND a single item from one composable every time, and threw
 * away whichever one the caller did not need — a list page paid for an item
 * fetch it never used, and an edit page paid for a list fetch it never used.
 * `usePlutoContentList` only ever fetches a list, because a list page only
 * ever needs a list.
 *
 * It is also not a "fake thenable": it returns plain refs and explicit
 * methods, so a caller `await`s `refresh()` or `remove()` directly, instead
 * of `await`ing the composable's own return value through a hand-rolled
 * `.then()`.
 */
export function usePlutoContentList(
  typeName: string,
  options: PlutoContentListOptions = {}
) {
  const { pageSize } = options
  const url = `/api/_pluto/content/${typeName}`

  const items = ref<PlutoContentItem[]>([])
  const total = ref<number | undefined>(undefined)
  const pending = ref(false)
  const loadingMore = ref(false)
  /** `true` while more pages exist. Always `false` without `pageSize`. */
  const hasMore = ref(false)
  const error = ref<unknown>(null)

  // A refresh() while a page is in flight makes that page stale. Each fetch
  // remembers the generation it started in, and drops its result when a
  // newer refresh() has started since.
  let generation = 0

  function fetchPage(offset: number): Promise<PlutoContentListResult> {
    return pageSize === undefined
      ? $fetch<PlutoContentListResult>(url)
      : $fetch<PlutoContentListResult>(url, {
          query: { limit: pageSize, offset },
        })
  }

  function updateHasMore(lastPageLength: number) {
    if (pageSize === undefined) {
      hasMore.value = false
      return
    }
    // Without a total, a full page means there may be another one.
    hasMore.value =
      total.value === undefined
        ? lastPageLength === pageSize
        : items.value.length < total.value
  }

  async function refresh(): Promise<void> {
    const current = ++generation
    pending.value = true
    error.value = null

    try {
      const result = await fetchPage(0)
      if (current !== generation) {
        return
      }
      items.value = result.data
      total.value = result.total
      updateHasMore(result.data.length)
    } catch (caught) {
      if (current === generation) {
        error.value = caught
      }
      throw caught
    } finally {
      if (current === generation) {
        pending.value = false
      }
    }
  }

  /** Appends the next page. Does nothing without `pageSize`, without more pages, or while a fetch runs. */
  async function loadMore(): Promise<void> {
    if (!hasMore.value || pending.value || loadingMore.value) {
      return
    }
    const current = generation
    loadingMore.value = true

    try {
      const result = await fetchPage(items.value.length)
      if (current !== generation) {
        return
      }
      items.value = [...items.value, ...result.data]
      total.value = result.total ?? total.value
      updateHasMore(result.data.length)
    } catch (caught) {
      if (current === generation) {
        error.value = caught
      }
      throw caught
    } finally {
      loadingMore.value = false
    }
  }

  // Fire the initial fetch right away. /admin/** is client-only
  // (ssr: false in nuxt.config.ts), so there is no SSR payload concern —
  // this only ever runs in the browser. The failure path already lands in
  // `error` for a reactive consumer to read; swallow the rejection here so
  // it never surfaces as an unhandled rejection. A caller invoking
  // `refresh()` again later still gets a real rejection to `await`.
  refresh().catch(() => {})

  async function remove(id: string | number): Promise<void> {
    try {
      await $fetch(`${url}/${id}`, { method: 'DELETE' })
    } catch (caught) {
      error.value = caught
      throw caught
    }

    if (pageSize === undefined) {
      await refresh()
      return
    }

    // Paged: drop the row in place, so the user keeps the pages already
    // loaded and the scroll position.
    items.value = items.value.filter((item) => item.id !== id)
    if (total.value !== undefined) {
      total.value = Math.max(0, total.value - 1)
    }
  }

  return {
    items,
    total,
    pending,
    loadingMore,
    hasMore,
    error,
    refresh,
    loadMore,
    remove,
  }
}
