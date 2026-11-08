import type { PlutoContentStatus } from '../shared/types/content'
import { describe, expect, it } from 'vitest'
import {
  bulkStatusChange,
  runInBatches,
} from '../app/composables/internal/bulk-actions'

const workflow: PlutoContentStatus = {
  values: [
    { value: 'draft', label: 'Draft' },
    { value: 'review', label: 'Review' },
    { value: 'published', label: 'Published' },
  ],
  default: 'draft',
  publishedValue: 'published',
}

const items = [
  { id: 1, status: 'published' },
  { id: 2, status: 'draft' },
  { id: 3 },
  { id: 'a/b', status: 'review' },
]

describe('bulkStatusChange', () => {
  it('publishes the items that are not published', () => {
    expect(bulkStatusChange(items, 'publish', workflow)).toEqual({
      ids: [2, 3, 'a/b'],
      status: 'published',
    })
  })

  it('takes the published items back to the default status', () => {
    expect(bulkStatusChange(items, 'unpublish', workflow)).toEqual({
      ids: [1],
      status: 'draft',
    })
  })

  it('gives nothing for a type with no workflow, or no default to go back to', () => {
    expect(bulkStatusChange(items, 'publish', false)).toBeNull()
    expect(bulkStatusChange(items, 'publish', undefined)).toBeNull()
    expect(
      bulkStatusChange(items, 'unpublish', { ...workflow, default: undefined })
    ).toBeNull()
    expect(
      bulkStatusChange(items, 'unpublish', {
        ...workflow,
        default: 'published',
      })
    ).toBeNull()
  })

  it('unpublishes a scheduled item too, and publishes it now', () => {
    const scheduling: PlutoContentStatus = {
      ...workflow,
      publishedAtColumn: 'publishedAt',
      schedule: true,
    }
    const planned = [...items, { id: 5, status: 'scheduled' }]

    expect(bulkStatusChange(planned, 'unpublish', scheduling)!.ids).toEqual([
      1, 5,
    ])
    expect(bulkStatusChange(planned, 'publish', scheduling)!.ids).toEqual([
      2,
      3,
      'a/b',
      5,
    ])
    // Without the option, "scheduled" is only an unknown value.
    expect(bulkStatusChange(planned, 'unpublish', workflow)!.ids).toEqual([1])
  })

  it('counts a missing status as the default', () => {
    expect(
      bulkStatusChange([{ id: 9 }], 'unpublish', {
        ...workflow,
        default: 'draft',
      })?.ids
    ).toEqual([])
  })
})

describe('runInBatches', () => {
  it('runs every id, counts the failures, and never runs more than the size at once', async () => {
    let running = 0
    let peak = 0
    const seen: number[] = []
    const result = await runInBatches(
      [1, 2, 3, 4, 5, 6, 7],
      async (id) => {
        running += 1
        peak = Math.max(peak, running)
        await new Promise((resolve) => setTimeout(resolve, 5))
        running -= 1
        seen.push(id)
        if (id % 3 === 0) {
          throw new Error('no')
        }
      },
      3
    )

    expect(result).toEqual({ done: 5, failed: 2 })
    expect(peak).toBe(3)
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('does nothing for no id', async () => {
    expect(await runInBatches([], async () => {})).toEqual({
      done: 0,
      failed: 0,
    })
  })
})
