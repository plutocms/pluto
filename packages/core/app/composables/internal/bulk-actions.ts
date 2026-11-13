import type {
  PlutoContentItem,
  PlutoContentStatus,
} from '../../../shared/types/content'
import { statusRules } from '../../../shared/utils/content-status'

export type PlutoBulkAction = 'publish' | 'unpublish' | 'remove'

export interface PlutoBulkResult {
  done: number
  failed: number
}

const BULK_CONCURRENCY = 4

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
  const scheduled = statusRules({ status: workflow })?.scheduled
  const ids = items
    .filter((item) => {
      const current = (item.status as string | undefined) ?? workflow.default
      return action === 'publish'
        ? current !== published
        : current === published ||
            (scheduled !== undefined && current === scheduled)
    })
    .map((item) => item.id)
  return { ids, status }
}

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
