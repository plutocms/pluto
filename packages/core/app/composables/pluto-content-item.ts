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
 * watched for later changes. A page must mount the form again when the id
 * changes. The generated page `[id].vue` does this with `:key` on the route
 * id.
 *
 * @see https://pluto.vulmix.dev/docs/reference/content-model
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
  const loadError = ref<unknown>(null)

  async function refresh(): Promise<void> {
    if (isNew) {
      return
    }

    pending.value = true
    error.value = null
    loadError.value = null

    try {
      item.value = await $fetch<PlutoContentItem>(
        `/api/_pluto/content/${typeName}/${contentIdPath(resolvedId)}`
      )
    } catch (caught) {
      error.value = caught
      loadError.value = caught
      throw caught
    } finally {
      pending.value = false
    }
  }

  refresh().catch(() => {})

  async function save(
    values: Record<string, unknown>
  ): Promise<PlutoContentItem> {
    error.value = null

    try {
      const saved = isNew
        ? await $fetch<PlutoContentItem>(`/api/_pluto/content/${typeName}`, {
            method: 'POST',
            body: values,
          })
        : await $fetch<PlutoContentItem>(
            `/api/_pluto/content/${typeName}/${contentIdPath(resolvedId)}`,
            {
              method: 'PATCH',
              body: values,
            }
          )

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
      await $fetch<unknown>(
        `/api/_pluto/content/${typeName}/${contentIdPath(resolvedId)}`,
        { method: 'DELETE' }
      )
    } catch (caught) {
      error.value = caught
      throw caught
    }
  }

  return { item, pending, error, loadError, refresh, save, remove }
}
