import { contentIdPath } from '../../shared/utils/content-id'

/** The most trashed items that the Trash view shows at once. */
const TRASH_VIEW_LIMIT = 100

function trashUrl(typeName: string, id?: string | number): string {
  const base = `/api/_pluto/content-trash/${typeName}`
  return id === undefined ? base : `${base}/${contentIdPath(id)}`
}

/** Moves a trashed item back. Answers the item. 409 when a live item has its id. */
export async function restorePlutoTrashItem(
  typeName: string,
  id: string | number
): Promise<void> {
  await $fetch(trashUrl(typeName, id), { method: 'POST' })
}

/** Deletes a trashed item forever. */
export async function purgePlutoTrashItem(
  typeName: string,
  id: string | number
): Promise<void> {
  await $fetch(trashUrl(typeName, id), { method: 'DELETE' })
}

/**
 * The trash of one content type, for the Trash tab of the list (`PlutoContentTrash`). It loads up
 * to `TRASH_VIEW_LIMIT` items, the last trashed first; `total` counts them all. Opening it also
 * purges the items older than 30 days (on the server). See the content-model skill ("Trash").
 */
export function usePlutoContentTrash(
  typeName: string,
  options: { search?: MaybeRefOrGetter<string | undefined> } = {}
) {
  const items = ref<PlutoContentItem[]>([])
  const total = ref(0)
  const pending = ref(false)
  const error = ref<unknown>(null)
  let generation = 0

  async function refresh(): Promise<void> {
    const current = ++generation
    pending.value = true
    error.value = null
    try {
      const search = toValue(options.search)?.trim()
      const result = await $fetch<PlutoContentListResult>(trashUrl(typeName), {
        query: { limit: TRASH_VIEW_LIMIT, ...(search && { search }) },
      })
      if (current === generation) {
        items.value = result.data
        total.value = result.total ?? result.data.length
      }
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

  async function empty(): Promise<number> {
    const result = await $fetch<{ purged: number }>(trashUrl(typeName), {
      method: 'DELETE',
    })
    return result.purged
  }

  refresh().catch(() => {})
  if (options.search !== undefined) {
    watch(
      () => toValue(options.search)?.trim() ?? '',
      () => {
        refresh().catch(() => {})
      }
    )
  }

  return { items, total, pending, error, refresh, empty }
}

/** The number of trashed items of a type, for the badge of the Trash tab. `null` until it loads. */
export function usePlutoContentTrashCount(typeName: MaybeRefOrGetter<string>) {
  const count = ref<number | null>(null)
  async function refresh(): Promise<void> {
    try {
      const result = await $fetch<PlutoContentListResult>(
        trashUrl(toValue(typeName)),
        { query: { limit: 1 } }
      )
      count.value = result.total ?? result.data.length
    } catch {
      count.value = null
    }
  }
  refresh()
  return { count, refresh }
}
