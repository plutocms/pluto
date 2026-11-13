import type { H3Event } from 'h3'
import type {
  PlutoContentAdapter,
  PlutoContentContext,
  PlutoContentItem,
  PlutoContentListResult,
  PlutoContentQuery,
} from '../../shared/types/content'
import type { PlutoContentBackup } from '../../shared/utils/content-backup'

interface MemoryContentAdapterOptions {
  authorize?: (event: H3Event, capability: string) => Promise<void>
  /** Add `backups`: a server copy with one map for each caller. */
  backups?: boolean
}

/** The caller of a request in the tests: `event.context.userId`, or an empty id. */
export function memoryCaller(event: H3Event): string {
  return String(
    (event as { context?: { userId?: unknown } }).context?.userId ?? ''
  )
}

/**
 * An in-memory `PlutoContentAdapter` for tests. It is never registered in the real app.
 *
 * Pass `options.authorize` to test a capability check that throws (the 403
 * path). Omit it to test the fail-open path (no `authorize` method at all).
 *
 * Pass `options.backups` to add `backups`. Each caller (see `memoryCaller`) has its own map, and
 * a `put` reports `otherDevice` when the replaced record has another `device`.
 */
export function createMemoryContentAdapter(
  options?: MemoryContentAdapterOptions
): PlutoContentAdapter {
  const rows: PlutoContentItem[] = []
  let nextId = 1

  function titleValue(ctx: PlutoContentContext, row: PlutoContentItem): string {
    return String(row[ctx.type.titleField] ?? '')
  }

  const adapter: PlutoContentAdapter = {
    id: 'memory',

    async list(
      ctx: PlutoContentContext,
      query: PlutoContentQuery
    ): Promise<PlutoContentListResult> {
      let data = rows

      if (!query.includeUnpublished) {
        data = data.filter(
          (row) => row.status === undefined || row.status === 'published'
        )
      }

      if (query.status !== undefined && ctx.type.status) {
        const fallback = ctx.type.status.default
        data = data.filter(
          (row) => String(row.status ?? fallback) === query.status
        )
      }

      if (query.search) {
        const needle = query.search.toLowerCase()
        data = data.filter((row) =>
          titleValue(ctx, row).toLowerCase().includes(needle)
        )
      }

      if (query.ids) {
        const wanted = new Set(query.ids.map(String))
        data = data.filter((row) => wanted.has(String(row.id)))
      }

      for (const [name, value] of Object.entries(query.filters ?? {})) {
        data = data.filter((row) => {
          const stored = row[name]
          return Array.isArray(stored)
            ? stored.some((entry) => String(entry) === value)
            : String(stored ?? '') === value
        })
      }

      return { data, total: data.length }
    },

    async get(_ctx, idOrSlug) {
      return rows.find((row) => String(row.id) === String(idOrSlug)) ?? null
    },

    async create(_ctx, values) {
      const item: PlutoContentItem = {
        ...values,
        id: nextId++,
      } as PlutoContentItem
      rows.push(item)
      return item
    },

    async update(_ctx, id, values) {
      const index = rows.findIndex((row) => String(row.id) === String(id))
      if (index === -1) {
        throw new Error(`No item with id "${id}".`)
      }
      const existing = rows[index] as PlutoContentItem
      const updated: PlutoContentItem = {
        ...existing,
        ...values,
        id: existing.id,
      }
      rows[index] = updated
      return updated
    },

    async remove(_ctx, id) {
      const index = rows.findIndex((row) => String(row.id) === String(id))
      if (index !== -1) {
        rows.splice(index, 1)
      }
    },
  }

  if (options?.backups) {
    const maps = new Map<string, Map<string, PlutoContentBackup>>()
    const mapOf = (ctx: PlutoContentContext) => {
      const caller = memoryCaller(ctx.event)
      let map = maps.get(caller)
      if (!map) {
        map = new Map()
        maps.set(caller, map)
      }
      return map
    }
    const slot = (ctx: PlutoContentContext, key: string) =>
      `${ctx.type.name}:${key}`
    adapter.backups = {
      async get(ctx, key) {
        return mapOf(ctx).get(slot(ctx, key)) ?? null
      },
      async put(ctx, key, record) {
        const map = mapOf(ctx)
        const before = map.get(slot(ctx, key))
        map.set(slot(ctx, key), record)
        return {
          otherDevice: Boolean(before && before.device !== record.device),
        }
      },
      async remove(ctx, key) {
        mapOf(ctx).delete(slot(ctx, key))
      },
    }
  }

  if (options?.authorize) {
    adapter.authorize = options.authorize
  }

  return adapter
}
