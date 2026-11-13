// No Nuxt auto-imports here: plain Vitest imports this file.
import type { PlutoContentBackup } from '../../../shared/utils/content-backup'

export type BackupStorage = Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'
>

const BACKUP_PREFIX = 'pluto:backup:'
const DEVICE_KEY = 'pluto:device'

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

export function isBackupKeyOf(
  key: string,
  base: string,
  userId: string
): boolean {
  const parts = parseKey(key)
  return parts !== null && parts[0] === base && parts[1] === userId
}

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
  maxChars: number
  maxTotalChars: number
  maxCount: number
  ttlMs: number
  now: () => number
  parse: (
    value: unknown,
    options: { now: number; ttlMs: number }
  ) => PlutoContentBackup | null
}

interface Entry {
  key: string
  size: number
  savedAt: number
  stale: boolean
}

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

  function oldestFirst(list: Entry[]): Entry[] {
    return list.toSorted((a, b) => a.savedAt - b.savedAt)
  }

  function ofScopeOf(key: string): (other: string) => boolean {
    const parts = parseKey(key)
    return (other) =>
      parts !== null && isBackupKeyOf(other, String(parts[0]), String(parts[1]))
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

    write(key: string, record: PlutoContentBackup): BackupWriteResult {
      const text = JSON.stringify(record)
      if (text.length > limits.maxChars) {
        return 'too-large'
      }

      const others = oldestFirst(entries((other) => other !== key))
      const scoped = ofScopeOf(key)
      let total = others.reduce((sum, entry) => sum + entry.size, 0)
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
    flush() {
      if (timer !== null) {
        clear()
        options.run()
      }
    },
    cancel: clear,
  }
}

export function randomId(): string {
  const crypto = globalThis.crypto as Crypto | undefined
  if (typeof crypto?.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

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
