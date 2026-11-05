import type { H3Event } from 'h3'

/** One published item of a public type, for the sitemap and the feed. */
export interface PlutoSeoEntry {
  /** The site path of the page (`type.previewUrl`). */
  path: string
  /** The item as the adapter gives it. */
  item: PlutoContentItem
  /** The item says `seoNoindex`. */
  noindex: boolean
  publishedAt?: string
  updatedAt?: string
  /** The public answer of the item (`withData` only): the same data as the public API list. */
  data?: Record<string, unknown>
}

export interface PlutoSeoEntriesOptions {
  /** The most entries. Default: all of them. */
  limit?: number
  /** A sort of the public API: a field name, or `-field` for descending. Default: the sort of the type. */
  sort?: string
  /** Add `data`, the public answer of each item (the feed needs it). */
  withData?: boolean
  /** Leave out the items that say `seoNoindex`. They do not count for `limit`. */
  skipNoindex?: boolean
}

/** The items per call to the adapter. */
const PAGE = 100

function stamp(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

/**
 * The published items of a public content type that have a page (`type.previewUrl`), for the
 * sitemap and the feed. The read is a public read: drafts never show. A type that is missing,
 * private, or without `previewUrl` gives `[]`. The adapter is called by pages of 100.
 *
 * @example
 * const entries = await plutoSeoListEntries(event, 'post', { sort: '-publishedAt', limit: 20 })
 */
export async function plutoSeoListEntries(
  event: H3Event,
  typeName: string,
  options: PlutoSeoEntriesOptions = {}
): Promise<PlutoSeoEntry[]> {
  markPublicRead(event)
  const type = getContentType(typeName)
  if (!type || type.api?.public !== true || !type.previewUrl) {
    return []
  }
  const adapter = requireContentAdapter()
  const ctx = { event, type }
  const keys = adapter.timestampKeys?.(type) ?? {}
  const limit = options.limit ?? Number.POSITIVE_INFINITY

  let sort = type.defaultSort
  if (options.sort) {
    try {
      sort = parsePublicQuery(type, { sort: options.sort }).sort ?? sort
    } catch {
      // The type has no such field: keep the sort of the type.
    }
  }

  const entries: PlutoSeoEntry[] = []
  let offset = 0
  while (entries.length < limit) {
    const result = await adapter.list(ctx, {
      limit: PAGE,
      offset,
      sort,
      includeUnpublished: false,
    })
    // The adapter filters drafts already. This check makes sure that no adapter can leak one.
    const items = result.data.filter((item) => isPublishedItem(type, item))
    for (const item of items) {
      const path = type.previewUrl(item)
      const noindex = item.seoNoindex === true
      if (!path || (options.skipNoindex && noindex)) {
        continue
      }
      if (entries.length >= limit) {
        break
      }
      entries.push({
        path,
        item,
        noindex,
        publishedAt: stamp(keys.published && item[keys.published]),
        updatedAt: stamp(keys.updated && item[keys.updated]),
      })
      if (options.withData) {
        const entry = entries.at(-1)!
        entry.data = await toPublicData(ctx, item, 'list', items)
      }
    }
    offset += PAGE
    if (
      result.data.length < PAGE ||
      (result.total !== undefined && offset >= result.total)
    ) {
      break
    }
  }
  return entries
}
