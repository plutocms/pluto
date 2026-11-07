import type {
  PlutoContentItem,
  PlutoContentStatus,
} from '../../../shared/types/content'

/** A bulk action of the admin list. */
export type PlutoBulkAction = 'publish' | 'unpublish' | 'remove'

/** The result of a bulk action: the items it changed and the items that failed. */
export interface PlutoBulkResult {
  done: number
  failed: number
}

/** How many requests a bulk action runs at a time. */
export const BULK_CONCURRENCY = 4

/**
 * The items that a status action changes, and the status it gives them. Publish takes the items
 * that are not published, unpublish the published ones (they go back to the default status). An
 * item that has the status already needs no request. Without a workflow, nothing.
 */
export function bulkStatusChange(
  items: PlutoContentItem[],
  action: 'publish' | 'unpublish',
  workflow: PlutoContentStatus | false | undefined
): { ids: Array<string | number>; status: string } | null {
  if (!workflow) {
    return null
  }
  const published = workflow.publishedValue ?? 'published'
  const status = action === 'publish' ? published : workflow.default
  if (
    status === undefined ||
    (action === 'unpublish' && status === published)
  ) {
    return null
  }
  const ids = items
    .filter((item) => {
      const current = (item.status as string | undefined) ?? workflow.default
      return action === 'publish'
        ? current !== published
        : current === published
    })
    .map((item) => item.id)
  return { ids, status }
}

/**
 * Runs `task` for each id, `size` at a time, and counts the ids that worked and the ids that
 * failed. A failure does not stop the others.
 */
export async function runInBatches<T>(
  ids: T[],
  task: (id: T) => Promise<unknown>,
  size = BULK_CONCURRENCY
): Promise<PlutoBulkResult> {
  const queue = [...ids]
  const result: PlutoBulkResult = { done: 0, failed: 0 }
  async function worker() {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      try {
        await task(id)
        result.done += 1
      } catch {
        result.failed += 1
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, size), queue.length) }, worker)
  )
  return result
}
