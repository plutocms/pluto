import type { PlutoContentType } from '../types/content'

/**
 * The status workflow of a content type: the published, draft, scheduled and review values, and
 * the rules that the admin, the adapters and the public API share. See the content-model skill
 * ("Scheduled publish and review").
 */
export interface PlutoStatusRules {
  /** The storage column of the status. */
  column: string
  /** The value that counts as published. */
  published: string
  /** The value of a draft: the default of the type, else the first value that is not published. */
  draft: string | undefined
  /** The scheduled value, when the type has `status.schedule` and a `publishedAtColumn`. */
  scheduled: string | undefined
  /** The review value, when the type has `status.review`. */
  review: string | undefined
  /** The column of the publish time. A scheduled item keeps its planned time here. */
  publishedAtColumn: string | undefined
}

type StatusType = Pick<PlutoContentType, 'status'> | undefined

function optionValue(
  option: boolean | { value?: string } | undefined,
  fallback: string
): string | undefined {
  if (!option) {
    return undefined
  }
  return (typeof option === 'object' && option.value) || fallback
}

/** The status rules of a type, or `null` for a type with no status workflow. */
export function statusRules(type: StatusType): PlutoStatusRules | null {
  const status = type?.status
  if (!status) {
    return null
  }
  const published = status.publishedValue || 'published'
  return {
    column: status.column ?? 'status',
    published,
    draft:
      status.default ??
      (status.values ?? []).find((entry) => entry.value !== published)?.value,
    scheduled: status.publishedAtColumn
      ? optionValue(status.schedule, 'scheduled')
      : undefined,
    review: optionValue(status.review, 'review'),
    publishedAtColumn: status.publishedAtColumn,
  }
}

/**
 * The status values of a type: `status.values`, then the scheduled and review values when the
 * type has them (with the value as the label; the admin translates it). Empty with no workflow.
 */
export function contentStatusValues(
  type: StatusType
): Array<{ label: string; value: string }> {
  const rules = statusRules(type)
  if (!rules || !type?.status) {
    return []
  }
  const values = [...(type.status.values ?? [])]
  for (const extra of [rules.review, rules.scheduled]) {
    if (extra && !values.some((entry) => entry.value === extra)) {
      values.push({ label: extra, value: extra })
    }
  }
  return values
}

/** The time in milliseconds, or `undefined` for a missing or bad value. */
export function statusTime(value: unknown): number | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.getTime()
  }
  if (typeof value !== 'string' || !value) {
    return undefined
  }
  const time = Date.parse(value)
  return Number.isNaN(time) ? undefined : time
}

/**
 * Whether an item is on the public site at `now`: a type with no status workflow, a published
 * item, or a scheduled item whose time is `now` or earlier. A missing status counts as the default
 * of the type.
 */
export function isLiveStatus(
  type: StatusType,
  status: unknown,
  publishedAt: unknown,
  now: number = Date.now()
): boolean {
  const rules = statusRules(type)
  if (!rules) {
    return true
  }
  const value = status ?? (type?.status ? type.status.default : undefined)
  if (value === rules.published) {
    return true
  }
  if (rules.scheduled !== undefined && value === rules.scheduled) {
    const time = statusTime(publishedAt)
    return time !== undefined && time <= now
  }
  return false
}

/** `isLiveStatus` for an item that has the status and the time under their storage columns. */
export function isLiveItem(
  type: StatusType,
  item: Record<string, unknown>,
  now: number = Date.now()
): boolean {
  const rules = statusRules(type)
  if (!rules) {
    return true
  }
  return isLiveStatus(
    type,
    item[rules.column] ?? item.status,
    rules.publishedAtColumn ? item[rules.publishedAtColumn] : undefined,
    now
  )
}

/**
 * Whether a save needs the publish capability. `from` is the stored status (`undefined` for a
 * create), `to` the status after the save. A user with only the write capability can keep a draft
 * or a review item, and move it between draft and review. Publish is needed to set or to leave the
 * published or the scheduled value, and to change a published or scheduled item at all.
 */
export function statusChangeNeedsPublish(
  type: StatusType,
  from: unknown,
  to: unknown
): boolean {
  const rules = statusRules(type)
  if (!rules) {
    return false
  }
  const gated = [rules.published, rules.scheduled].filter(
    (value): value is string => value !== undefined
  )
  return gated.includes(String(from)) || gated.includes(String(to))
}

/**
 * The error key for a scheduled save, or `undefined` when it is good: the type must have the
 * scheduled value, and the time must be a date after `now`.
 */
export function scheduleError(
  type: StatusType,
  publishAt: unknown,
  now: number = Date.now()
): string | undefined {
  if (!statusRules(type)?.scheduled) {
    return 'pluto.errors.validationFailed'
  }
  const time = statusTime(publishAt)
  if (time === undefined) {
    return 'pluto.errors.scheduleTime'
  }
  return time <= now ? 'pluto.errors.scheduleInPast' : undefined
}
