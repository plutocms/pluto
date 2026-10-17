export interface PlutoContentStat {
  name: string
  label: string
  labelPlural: string
  icon?: string
  /** Admin list path for the content type. */
  path: string
  total: number
  /** Present only for a content type with a status workflow. */
  published?: number
  /** Present only for a content type with a status workflow. */
  drafts?: number
}

/**
 * Counts the items of every registered content type, for the dashboard.
 *
 * Each count is a list request with `limit=1`, so the adapter returns the
 * count without the rows. A type with a status workflow gets a second
 * request with `published=1`. Drafts are the total minus the published
 * count. An adapter that does not return `total` gets one request without
 * a limit, and the count is the number of rows.
 */
export function usePlutoContentStats() {
  const { items: contentTypes } = usePlutoContentTypes()

  const stats = ref<PlutoContentStat[]>([])
  const pending = ref(false)
  const error = ref<unknown>(null)

  async function count(typeName: string, published: boolean): Promise<number> {
    const url = `/api/_pluto/content/${typeName}`
    const query = published ? { limit: 1, published: 1 } : { limit: 1 }
    const result = await $fetch<PlutoContentListResult>(url, { query })
    if (result.total !== undefined) {
      return result.total
    }
    const all = await $fetch<PlutoContentListResult>(url, { query: published ? { published: 1 } : {} })
    return all.data.length
  }

  async function refresh(): Promise<void> {
    pending.value = true
    error.value = null

    try {
      stats.value = await Promise.all(
        contentTypes.value.map(async ({ type }) => {
          const [total, published] = await Promise.all([
            count(type.name, false),
            type.status ? count(type.name, true) : Promise.resolve(undefined),
          ])

          return {
            name: type.name,
            label: type.label,
            labelPlural: type.labelPlural,
            icon: type.icon,
            path: type.basePath ?? `/admin/content/${type.name}`,
            total,
            ...(published === undefined ? {} : { published, drafts: Math.max(0, total - published) }),
          }
        })
      )
    } catch (caught) {
      error.value = caught
      throw caught
    } finally {
      pending.value = false
    }
  }

  // Same pattern as usePlutoContentList: fetch right away, and keep a
  // failure in `error` instead of an unhandled rejection.
  refresh().catch(() => {})

  return { stats, pending, error, refresh }
}
