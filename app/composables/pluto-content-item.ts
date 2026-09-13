/**
 * Loads (or creates) one item of one content type, for the generic form page
 * (`PlutoContentForm`).
 *
 * This is one half of the split that replaces the old `usePost`/`useProduct`
 * pattern (see `usePlutoContentList` for the other half). That old pattern
 * fetched a list AND a single item from one composable every time, and threw
 * away whichever one the caller did not need. `usePlutoContentItem` only
 * ever fetches a single item, and only when `id` is defined — a "new entry"
 * form never fires a GET at all.
 *
 * It is also not a "fake thenable": it returns plain refs and explicit
 * methods, so a caller `await`s `save()`/`remove()`/`refresh()` directly,
 * instead of `await`ing the composable's own return value through a
 * hand-rolled `.then()`.
 *
 * `id` is read once, with `toValue`, at composable-creation time. It is not
 * watched for later changes — each of the three generated pages
 * (`app/pages/admin/content/[type]/{index,new,[id]}.vue`) mounts fresh on
 * every route change, so there is no case in this wave where `id` changes
 * under a still-mounted `PlutoContentForm`.
 */
export function usePlutoContentItem(
  typeName: string,
  id: MaybeRefOrGetter<string | number | undefined>
) {
  const resolvedId = toValue(id)
  const isNew = resolvedId === undefined

  const item = ref<Record<string, unknown>>({})
  const pending = ref(false)
  const error = ref<unknown>(null)

  async function refresh(): Promise<void> {
    // A new, unsaved entry has nothing to fetch — `item` stays the empty
    // object it started as.
    if (isNew) {
      return
    }

    pending.value = true
    error.value = null

    try {
      item.value = await $fetch<PlutoContentItem>(`/api/_pluto/content/${typeName}/${resolvedId}`)
    } catch (caught) {
      error.value = caught
      throw caught
    } finally {
      pending.value = false
    }
  }

  // Fire the initial fetch right away, same reasoning as
  // usePlutoContentList: /admin/** is client-only, so there is no SSR
  // payload concern. The failure path already lands in `error` for a
  // reactive consumer to read; swallow the rejection here so it never
  // surfaces as an unhandled rejection. A caller invoking `refresh()`
  // again later still gets a real rejection to `await`.
  refresh().catch(() => {})

  async function save(values: Record<string, unknown>): Promise<PlutoContentItem> {
    error.value = null

    try {
      const saved = isNew
        ? await $fetch<PlutoContentItem>(`/api/_pluto/content/${typeName}`, {
            method: 'POST',
            body: values,
          })
        : await $fetch<PlutoContentItem>(`/api/_pluto/content/${typeName}/${resolvedId}`, {
            method: 'PATCH',
            body: values,
          })

      item.value = saved
      return saved
    } catch (caught) {
      error.value = caught
      throw caught
    }
  }

  async function remove(): Promise<void> {
    if (isNew) {
      throw new Error('Cannot remove an entry that has not been saved yet.')
    }

    try {
      await $fetch(`/api/_pluto/content/${typeName}/${resolvedId}`, { method: 'DELETE' })
    } catch (caught) {
      error.value = caught
      throw caught
    }
  }

  return { item, pending, error, refresh, save, remove }
}
