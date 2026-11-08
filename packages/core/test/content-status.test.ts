import type { PlutoContentType } from '../shared/types/content'
import { describe, expect, it } from 'vitest'
import {
  contentStatusValues,
  isLiveItem,
  isLiveStatus,
  scheduleError,
  statusChangeNeedsPublish,
  statusRules,
} from '../shared/utils/content-status'

const NOW = Date.parse('2026-05-01T12:00:00Z')

function typeWith(status: PlutoContentType['status']) {
  return { status } as Pick<PlutoContentType, 'status'>
}

const workflow = typeWith({
  values: [
    { label: 'Draft', value: 'draft' },
    { label: 'Published', value: 'published' },
  ],
  default: 'draft',
  publishedValue: 'published',
  publishedAtColumn: 'published_at',
  schedule: true,
  review: true,
})

describe('statusRules', () => {
  it('reads the values, with the defaults of the options', () => {
    expect(statusRules(workflow)).toEqual({
      column: 'status',
      published: 'published',
      draft: 'draft',
      scheduled: 'scheduled',
      review: 'review',
      publishedAtColumn: 'published_at',
    })
    expect(
      statusRules(
        typeWith({
          values: [{ label: 'Live', value: 'live' }],
          publishedValue: 'live',
          publishedAtColumn: 'at',
          schedule: { value: 'planned' },
          review: { value: 'pending' },
        })
      )
    ).toMatchObject({ scheduled: 'planned', review: 'pending' })
  })

  it('has no schedule without a time column, and nothing without a workflow', () => {
    expect(
      statusRules(
        typeWith({
          values: [{ label: 'Draft', value: 'draft' }],
          schedule: true,
        })
      )!.scheduled
    ).toBeUndefined()
    expect(statusRules(typeWith(false))).toBeNull()
    expect(statusRules(undefined)).toBeNull()
  })
})

describe('contentStatusValues', () => {
  it('adds review and scheduled once, after the values of the type', () => {
    expect(contentStatusValues(workflow).map((entry) => entry.value)).toEqual([
      'draft',
      'published',
      'review',
      'scheduled',
    ])
    const listed = typeWith({
      values: [
        { label: 'Draft', value: 'draft' },
        { label: 'Planned', value: 'scheduled' },
      ],
      publishedAtColumn: 'at',
      schedule: true,
    })
    expect(contentStatusValues(listed)).toEqual([
      { label: 'Draft', value: 'draft' },
      { label: 'Planned', value: 'scheduled' },
    ])
    expect(contentStatusValues(typeWith(false))).toEqual([])
  })
})

describe('isLiveStatus and isLiveItem', () => {
  it('is live when published, or scheduled with a time that has come', () => {
    expect(isLiveStatus(workflow, 'published', undefined, NOW)).toBe(true)
    expect(isLiveStatus(workflow, 'draft', undefined, NOW)).toBe(false)
    expect(isLiveStatus(workflow, 'review', undefined, NOW)).toBe(false)
    expect(
      isLiveStatus(workflow, 'scheduled', '2026-05-01T11:59:59Z', NOW)
    ).toBe(true)
    expect(
      isLiveStatus(workflow, 'scheduled', '2026-05-01T12:00:00Z', NOW)
    ).toBe(true)
    expect(
      isLiveStatus(workflow, 'scheduled', '2026-05-01T12:00:01Z', NOW)
    ).toBe(false)
    expect(isLiveStatus(workflow, 'scheduled', 'not a date', NOW)).toBe(false)
    expect(isLiveStatus(workflow, 'scheduled', null, NOW)).toBe(false)
  })

  it('uses the default for a missing status, and is always live with no workflow', () => {
    expect(isLiveStatus(workflow, undefined, undefined, NOW)).toBe(false)
    expect(isLiveStatus(typeWith(false), 'draft', undefined, NOW)).toBe(true)
  })

  it('reads an item by its storage keys', () => {
    expect(
      isLiveItem(
        workflow,
        { status: 'scheduled', published_at: '2026-04-01T00:00:00Z' },
        NOW
      )
    ).toBe(true)
    expect(
      isLiveItem(
        workflow,
        { status: 'scheduled', published_at: '2026-06-01T00:00:00Z' },
        NOW
      )
    ).toBe(false)
  })
})

describe('statusChangeNeedsPublish', () => {
  it('lets a writer keep or move a draft or a review item only', () => {
    expect(statusChangeNeedsPublish(workflow, undefined, 'draft')).toBe(false)
    expect(statusChangeNeedsPublish(workflow, 'draft', 'review')).toBe(false)
    expect(statusChangeNeedsPublish(workflow, 'review', 'draft')).toBe(false)
    expect(statusChangeNeedsPublish(workflow, 'review', 'review')).toBe(false)
  })

  it('needs publish to set, leave or change a published or scheduled item', () => {
    expect(statusChangeNeedsPublish(workflow, undefined, 'published')).toBe(
      true
    )
    expect(statusChangeNeedsPublish(workflow, 'review', 'scheduled')).toBe(true)
    expect(statusChangeNeedsPublish(workflow, 'published', 'draft')).toBe(true)
    expect(statusChangeNeedsPublish(workflow, 'scheduled', 'draft')).toBe(true)
    expect(statusChangeNeedsPublish(workflow, 'published', 'published')).toBe(
      true
    )
    expect(statusChangeNeedsPublish(typeWith(false), 'a', 'b')).toBe(false)
  })
})

describe('scheduleError', () => {
  it('wants a time after now on a type with a schedule', () => {
    expect(scheduleError(workflow, '2026-05-02T00:00:00Z', NOW)).toBeUndefined()
    expect(scheduleError(workflow, '2026-05-01T12:00:00Z', NOW)).toBe(
      'pluto.errors.scheduleInPast'
    )
    expect(scheduleError(workflow, 'soon', NOW)).toBe(
      'pluto.errors.scheduleTime'
    )
    expect(scheduleError(workflow, undefined, NOW)).toBe(
      'pluto.errors.scheduleTime'
    )
    expect(
      scheduleError(
        typeWith({ values: [{ label: 'Draft', value: 'draft' }] }),
        '2026-05-02T00:00:00Z',
        NOW
      )
    ).toBe('pluto.errors.validationFailed')
  })
})
