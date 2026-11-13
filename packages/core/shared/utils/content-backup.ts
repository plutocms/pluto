import type { PlutoContentType, PlutoField } from '../types/content'
import { stableStringify } from './stable-stringify'

/** One changed field: the value at the baseline (`base`) and the value in the form (`value`). */
export interface PlutoContentBackupChange {
  base?: unknown
  value?: unknown
}

/** The unsaved changes of one item, as kept by the browser backup. Schema `v: 1`. */
export interface PlutoContentBackup {
  v: 1
  /** The time of the last change, in ms, from the browser clock. */
  savedAt: number
  /** The id of the browser that wrote the record. */
  device: string
  /** The id of the form mount that wrote the record. */
  tab: string
  /** The `_version` of the item at the baseline, when the item has one. */
  version?: string
  /** A new item: the user typed in the slug field, so the title stops filling it. */
  slugTouched?: boolean
  /** Only the fields that differ from the baseline. */
  changes: Record<string, PlutoContentBackupChange>
}

export const PLUTO_BACKUP_MAX_CHARS = 1_000_000
export const PLUTO_BACKUP_MAX_TOTAL_CHARS = 2_500_000
export const PLUTO_BACKUP_MAX_COUNT = 20
export const PLUTO_BACKUP_TTL_MS = 14 * 24 * 60 * 60 * 1000
const PLUTO_BACKUP_KEEPALIVE_BYTES = 60_000

export function backupFields(type: PlutoContentType): PlutoField[] {
  const statusColumn = type.status
    ? (type.status.column ?? 'status')
    : undefined
  return type.fields.filter(
    (field) => field.inForm !== false && field.name !== statusColumn
  )
}

export function backupChanges(
  fields: PlutoField[],
  baseline: Record<string, unknown>,
  current: Record<string, unknown>
): Record<string, PlutoContentBackupChange> {
  const changes: Record<string, PlutoContentBackupChange> = {}
  for (const field of fields) {
    const base = baseline[field.name]
    const value = current[field.name]
    if (stableStringify(base) !== stableStringify(value)) {
      changes[field.name] = { base, value }
    }
  }
  return changes
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function parseBackup(
  value: unknown,
  options: { now: number; ttlMs: number; fields?: PlutoField[] }
): PlutoContentBackup | null {
  if (
    !isRecord(value) ||
    value.v !== 1 ||
    typeof value.savedAt !== 'number' ||
    !Number.isFinite(value.savedAt) ||
    typeof value.device !== 'string' ||
    value.device === '' ||
    typeof value.tab !== 'string' ||
    !isRecord(value.changes)
  ) {
    return null
  }
  if (options.now - value.savedAt > options.ttlMs) {
    return null
  }

  const known = options.fields
    ? new Set(options.fields.map((field) => field.name))
    : undefined
  const changes: Record<string, PlutoContentBackupChange> = {}
  for (const [name, change] of Object.entries(value.changes)) {
    if (!isRecord(change) || (known && !known.has(name))) {
      continue
    }
    changes[name] = { base: change.base, value: change.value }
  }

  return {
    v: 1,
    savedAt: value.savedAt,
    device: value.device,
    tab: value.tab,
    ...(typeof value.version === 'string' ? { version: value.version } : {}),
    ...(typeof value.slugTouched === 'boolean'
      ? { slugTouched: value.slugTouched }
      : {}),
    changes,
  }
}

/** What a restore does against the current values. */
export interface PlutoBackupPlan {
  /** The fields to put in the form: the backup value of each field that differs from `current`. */
  values: Record<string, unknown>
  /** The fields that changed in both places: `current` is not the backup `base`. */
  conflicts: string[]
}

export function planRestore(
  fields: PlutoField[],
  record: PlutoContentBackup,
  current: Record<string, unknown>
): PlutoBackupPlan {
  const values: Record<string, unknown> = {}
  const conflicts: string[] = []
  for (const field of fields) {
    const change = record.changes[field.name]
    if (!change) {
      continue
    }
    const now = stableStringify(current[field.name])
    if (now === stableStringify(change.value)) {
      continue
    }
    values[field.name] = change.value ?? null
    if (now !== stableStringify(change.base)) {
      conflicts.push(field.name)
    }
  }
  return { values, conflicts }
}

/** The record that the form offers, and where it came from. */
export interface PlutoBackupPick {
  record: PlutoContentBackup
  source: 'local' | 'server'
  /** True when a server record comes from another device. */
  otherDevice: boolean
}

export function pickBackup(
  local: PlutoContentBackup | null,
  server: PlutoContentBackup | null,
  deviceId: string
): PlutoBackupPick | null {
  if (local && (!server || local.savedAt >= server.savedAt)) {
    return { record: local, source: 'local', otherDevice: false }
  }
  if (server) {
    return {
      record: server,
      source: 'server',
      otherDevice: server.device !== deviceId,
    }
  }
  return null
}

export function needsServerCopy(
  pick: PlutoBackupPick,
  server: PlutoContentBackup | null
): boolean {
  return (
    pick.source === 'local' &&
    (server === null || pick.record.savedAt > server.savedAt)
  )
}

export function keepaliveBody(
  record: PlutoContentBackup,
  maxBytes = PLUTO_BACKUP_KEEPALIVE_BYTES
): string | null {
  const text = JSON.stringify(record)
  return new TextEncoder().encode(text).length <= maxBytes ? text : null
}
