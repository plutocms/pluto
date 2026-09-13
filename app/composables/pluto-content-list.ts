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
export function usePlutoContentList(typeName: string) {
  const items = ref<PlutoContentItem[]>([])
  const total = ref<number | undefined>(undefined)
  const pending = ref(false)
  const error = ref<unknown>(null)

  async function refresh(): Promise<void> {
    pending.value = true
    error.value = null

    try {
      const result = await $fetch<PlutoContentListResult>(`/api/_pluto/content/${typeName}`)
      items.value = result.data
      total.value = result.total
    } catch (caught) {
      error.value = caught
      throw caught
    } finally {
      pending.value = false
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
      await $fetch(`/api/_pluto/content/${typeName}/${id}`, { method: 'DELETE' })
    } catch (caught) {
      error.value = caught
      throw caught
    }

    await refresh()
  }

  return { items, total, pending, error, refresh, remove }
}
