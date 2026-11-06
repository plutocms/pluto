// Pure part of the content backup: the keys, the `localStorage` store, the scheduler and the
// device id. It does not use Nuxt auto-imports, so plain Vitest can import it. It has no runtime
// import from `shared/` (a layer build cannot resolve one from `app/`), so the caller passes the
// parse function. See the content-backup skill.
import type { PlutoContentBackup } from '../../../shared/utils/content-backup'

/** The part of `Storage` that the store uses. A test passes a fake. */
export type BackupStorage = Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'
>

export const BACKUP_PREFIX = 'pluto:backup:'
const DEVICE_KEY = 'pluto:device'

/**
 * The `localStorage` key of one backup: the app base path, the user, the type and the item id.
 * A new item has the id `null`.
 */
export function backupKey(scope: {
  base: string
  userId: string
  type: string
  id?: string | number | null
}): string {
  return (
    BACKUP_PREFIX +
    JSON.stringify([
      scope.base,
      scope.userId,
      scope.type,
      scope.id === undefined || scope.id === null ? null : String(scope.id),
    ])
  )
}

function parseKey(key: string): unknown[] | null {
  if (!key.startsWith(BACKUP_PREFIX)) {
    return null
  }
  try {
    const parts: unknown = JSON.parse(key.slice(BACKUP_PREFIX.length))
    return Array.isArray(parts) && parts.length === 4 ? parts : null
  } catch {
    return null
  }
}

/** True when `key` is a backup key of this user under this base path. */
export function isBackupKeyOf(
  key: string,
  base: string,
  userId: string
): boolean {
  const parts = parseKey(key)
  return parts !== null && parts[0] === base && parts[1] === userId
}

/** Every backup key in the storage. A failing storage gives none. */
function listBackupKeys(storage: BackupStorage): string[] {
  const found: string[] = []
  try {
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index)
      if (key?.startsWith(BACKUP_PREFIX)) {
        found.push(key)
      }
    }
  } catch {
    // No storage: no keys.
  }
  return found
}

/** Removes every backup of this user under this base path. Sign-out calls it. */
export function clearUserBackups(
  storage: BackupStorage,
  base: string,
  userId: string
) {
  for (const key of listBackupKeys(storage)) {
    if (isBackupKeyOf(key, base, userId)) {
      try {
        storage.removeItem(key)
      } catch {
        // Nothing to do.
      }
    }
  }
}

export type BackupWriteResult = 'ok' | 'too-large' | 'quota'

export interface BackupStoreLimits {
  /** The most characters of one record, as JSON. */
  maxChars: number
  /** The most characters of all backups together (every user). */
  maxTotalChars: number
  /** The most backups of one user. The oldest `savedAt` goes first. */
  maxCount: number
  /** The age after which a record is removed, in ms. */
  ttlMs: number
  now: () => number
  /** Reads a parsed JSON value as a record, or `null`. `parseBackup` of `shared/utils`. */
  parse: (
    value: unknown,
    options: { now: number; ttlMs: number }
  ) => PlutoContentBackup | null
}

interface Entry {
  key: string
  size: number
  savedAt: number
  /** True when the text is not a valid, live record. */
  stale: boolean
}

/**
 * The store of the browser backups. It catches every storage error (private mode, a quota
 * error, a `SecurityError`): a failed read is "no backup", and a failed write is a result.
 */
export function createBackupStore(
  storage: BackupStorage,
  limits: BackupStoreLimits
) {
  const keys = () => listBackupKeys(storage)

  function parseText(text: string): PlutoContentBackup | null {
    try {
      return limits.parse(JSON.parse(text), {
        now: limits.now(),
        ttlMs: limits.ttlMs,
      })
    } catch {
      return null
    }
  }

  function entryOf(key: string): Entry | null {
    let text: string | null
    try {
      text = storage.getItem(key)
    } catch {
      return null
    }
    if (text === null) {
      return null
    }
    const record = parseText(text)
    return {
      key,
      size: text.length,
      savedAt: record?.savedAt ?? 0,
      stale: record === null,
    }
  }

  function remove(key: string) {
    try {
      storage.removeItem(key)
    } catch {
      // Nothing to do.
    }
  }

  function entries(filter: (key: string) => boolean = () => true): Entry[] {
    return keys()
      .filter(filter)
      .map(entryOf)
      .filter((entry): entry is Entry => entry !== null)
  }

  /** The oldest first. A stale entry counts as the oldest. */
  function oldestFirst(list: Entry[]): Entry[] {
    return list.toSorted((a, b) => a.savedAt - b.savedAt)
  }

  function ofScopeOf(key: string): (other: string) => boolean {
    const parts = parseKey(key)
    return (other) =>
      parts !== null &&
      isBackupKeyOf(other, String(parts[0]), String(parts[1]))
  }

  function trySet(key: string, text: string): boolean {
    try {
      storage.setItem(key, text)
      return true
    } catch {
      return false
    }
  }

  return {
    /** The record of `key`, or `null` for none, a bad text or an expired record (it is removed). */
    read(key: string): PlutoContentBackup | null {
      let text: string | null
      try {
        text = storage.getItem(key)
      } catch {
        return null
      }
      if (text === null) {
        return null
      }
      const record = parseText(text)
      if (!record) {
        remove(key)
      }
      return record
    },

    /**
     * Writes a record. `too-large`: the record, or all backups together, would pass the size
     * limit even after the older backups of this user go. `quota`: the browser refused the write
     * twice.
     */
    write(key: string, record: PlutoContentBackup): BackupWriteResult {
      const text = JSON.stringify(record)
      if (text.length > limits.maxChars) {
        return 'too-large'
      }

      const others = oldestFirst(entries((other) => other !== key))
      const scoped = ofScopeOf(key)
      let total = others.reduce((sum, entry) => sum + entry.size, 0)
      // The oldest backups of this user go first, until the total fits.
      for (const entry of others) {
        if (total + text.length <= limits.maxTotalChars) {
          break
        }
        if (scoped(entry.key)) {
          remove(entry.key)
          total -= entry.size
        }
      }
      if (total + text.length > limits.maxTotalChars) {
        return 'too-large'
      }

      if (!trySet(key, text)) {
        // Make room: the expired backups, then the oldest backup of this user. Try once more.
        for (const entry of entries((other) => other !== key)) {
          if (entry.stale) {
            remove(entry.key)
          }
        }
        const oldest = oldestFirst(
          entries((other) => other !== key && scoped(other))
        )[0]
        if (oldest) {
          remove(oldest.key)
        }
        if (!trySet(key, text)) {
          return 'quota'
        }
      }

      // The count limit of this user: the oldest go first.
      const own = oldestFirst(entries(scoped))
      for (const entry of own.slice(
        0,
        Math.max(0, own.length - limits.maxCount)
      )) {
        if (entry.key !== key) {
          remove(entry.key)
        }
      }
      return 'ok'
    },

    remove,

    /** Removes the expired and the broken backups of this user, and the ones over the count limit. */
    prune(base: string, userId: string) {
      const own = entries((key) => isBackupKeyOf(key, base, userId))
      for (const entry of own) {
        if (entry.stale) {
          remove(entry.key)
        }
      }
      const live = oldestFirst(own.filter((entry) => !entry.stale))
      for (const entry of live.slice(
        0,
        Math.max(0, live.length - limits.maxCount)
      )) {
        remove(entry.key)
      }
    },

    clearUser(base: string, userId: string) {
      clearUserBackups(storage, base, userId)
    },
  }
}

export type BackupStore = ReturnType<typeof createBackupStore>

/** The timer functions of the scheduler. A test passes fake ones. */
export interface SchedulerTimers {
  setTimeout: (callback: () => void, ms: number) => unknown
  clearTimeout: (id: unknown) => void
  now: () => number
}

const realTimers: SchedulerTimers = {
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
}

/**
 * Runs `run` `wait` ms after the last `schedule()`, and at most `maxWait` ms after the first
 * `schedule()` of a burst. So a long burst of typing still writes every `maxWait` ms.
 */
export function createBackupScheduler(options: {
  wait: number
  maxWait: number
  run: () => void
  timers?: SchedulerTimers
}) {
  const timers = options.timers ?? realTimers
  let timer: unknown = null
  let firstAt = 0

  function clear() {
    if (timer !== null) {
      timers.clearTimeout(timer)
      timer = null
    }
  }

  function fire() {
    timer = null
    options.run()
  }

  return {
    /** True while a run waits. */
    get pending() {
      return timer !== null
    },
    schedule() {
      const now = timers.now()
      if (timer === null) {
        firstAt = now
      } else {
        clear()
      }
      const left = Math.max(0, firstAt + options.maxWait - now)
      timer = timers.setTimeout(fire, Math.min(options.wait, left))
    },
    /** Runs now, when a run waits. */
    flush() {
      if (timer !== null) {
        clear()
        options.run()
      }
    },
    cancel: clear,
  }
}

/** A random id for a device or a form mount. */
export function randomId(): string {
  const crypto = globalThis.crypto as Crypto | undefined
  if (typeof crypto?.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/**
 * The id of this browser. It is kept in `localStorage`, so it stays the same between visits.
 * Sign-out keeps it, because it holds no personal data. Without storage, it is a new id each time.
 */
export function deviceId(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
  random: () => string = randomId
): string {
  try {
    const stored = storage?.getItem(DEVICE_KEY)
    if (stored) {
      return stored
    }
    const created = random()
    storage?.setItem(DEVICE_KEY, created)
    return created
  } catch {
    return random()
  }
}
