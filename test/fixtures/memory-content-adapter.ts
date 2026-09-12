import type { H3Event } from 'h3'
import type {
  PlutoContentAdapter,
  PlutoContentContext,
  PlutoContentItem,
  PlutoContentListResult,
  PlutoContentQuery,
} from '../../shared/types/content'

interface MemoryContentAdapterOptions {
  authorize?: (event: H3Event, capability: string) => Promise<void>
}

/**
 * An in-memory `PlutoContentAdapter`, for this wave's tests only. It is
 * never registered in the real app — a real adapter is `@plutocms/supabase`'s
 * job, in a later wave. Keep this simple: it is a test fixture, not a
 * reference implementation to study for adapter-authoring guidance (the
 * content-model skill covers that, in prose).
 *
 * Pass `options.authorize` to test a capability check that throws (the 403
 * path). Omit it to test the fail-open path (no `authorize` method at all).
 */
export function createMemoryContentAdapter(options?: MemoryContentAdapterOptions): PlutoContentAdapter {
  const rows: PlutoContentItem[] = []
  let nextId = 1

  function titleValue(ctx: PlutoContentContext, row: PlutoContentItem): string {
    return String(row[ctx.type.titleField] ?? '')
  }

  const adapter: PlutoContentAdapter = {
    id: 'memory',

    async list(ctx: PlutoContentContext, query: PlutoContentQuery): Promise<PlutoContentListResult> {
      let data = rows

      if (!query.includeUnpublished) {
        data = data.filter((row) => row.status === undefined || row.status === 'published')
      }

      if (query.search) {
        const needle = query.search.toLowerCase()
        data = data.filter((row) => titleValue(ctx, row).toLowerCase().includes(needle))
      }

      return { data, total: data.length }
    },

    async get(_ctx, idOrSlug) {
      return rows.find((row) => String(row.id) === String(idOrSlug)) ?? null
    },

    async create(_ctx, values) {
      const item: PlutoContentItem = { ...values, id: nextId++ } as PlutoContentItem
      rows.push(item)
      return item
    },

    async update(_ctx, id, values) {
      const index = rows.findIndex((row) => String(row.id) === String(id))
      if (index === -1) {
        throw new Error(`No item with id "${id}".`)
      }
      const existing = rows[index] as PlutoContentItem
      const updated: PlutoContentItem = { ...existing, ...values, id: existing.id }
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

  if (options?.authorize) {
    adapter.authorize = options.authorize
  }

  return adapter
}
