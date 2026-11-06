import type { BackupStorage } from '../app/composables/internal/content-backup-store'
import type { PlutoContentBackup } from '../shared/utils/content-backup'
import { describe, expect, it } from 'vitest'
import {
  backupKey,
  clearUserBackups,
  createBackupScheduler,
  createBackupStore,
  deviceId,
  isBackupKeyOf,
} from '../app/composables/internal/content-backup-store'
import { parseBackup } from '../shared/utils/content-backup'

const NOW = 1_800_000_000_000
const DAY = 24 * 60 * 60 * 1000

class FakeStorage implements BackupStorage {
  data = new Map<string, string>()
  /** Throws on `setItem` for this many calls. */
  failWrites = 0
  broken = false

  get length() {
    if (this.broken) {
      throw new Error('SecurityError')
    }
    return this.data.size
  }

  key(index: number) {
    return [...this.data.keys()][index] ?? null
  }

  getItem(key: string) {
    if (this.broken) {
      throw new Error('SecurityError')
    }
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string) {
    if (this.broken || this.failWrites > 0) {
      this.failWrites--
      throw new Error('QuotaExceededError')
    }
    this.data.set(key, value)
  }

  removeItem(key: string) {
    this.data.delete(key)
  }
}

function record(patch: Partial<PlutoContentBackup> = {}): PlutoContentBackup {
  return {
    v: 1,
    savedAt: NOW,
    device: 'device-a',
    tab: 'tab-a',
    changes: { title: { base: 'A', value: 'B' } },
    ...patch,
  }
}

function make(
  storage: FakeStorage,
  limits: Partial<Parameters<typeof createBackupStore>[1]> = {}
) {
  return createBackupStore(storage, {
    maxChars: 1000,
    maxTotalChars: 5000,
    maxCount: 3,
    ttlMs: 14 * DAY,
    now: () => NOW,
    parse: parseBackup,
    ...limits,
  })
}

function key(type: string, id: string | null = null, userId = 'u1') {
  return backupKey({ base: '/', userId, type, id })
}

/** A record of about `size` characters of JSON. */
function sized(size: number, savedAt = NOW) {
  return record({
    savedAt,
    changes: { body: { base: '', value: 'x'.repeat(size) } },
  })
}

describe('backupKey', () => {
  it('holds the base path, the user, the type and the id', () => {
    expect(backupKey({ base: '/', userId: 'u1', type: 'post', id: 'a' })).toBe(
      'pluto:backup:["/","u1","post","a"]'
    )
  })

  it('keeps the slashes of a nested id', () => {
    expect(
      backupKey({ base: '/', userId: 'u1', type: 'doc', id: 'guide/intro' })
    ).toBe('pluto:backup:["/","u1","doc","guide/intro"]')
  })

  it('uses null for a new item', () => {
    expect(backupKey({ base: '/', userId: 'u1', type: 'post' })).toBe(
      'pluto:backup:["/","u1","post",null]'
    )
    expect(backupKey({ base: '/', userId: 'u1', type: 'post', id: null })).toBe(
      backupKey({ base: '/', userId: 'u1', type: 'post' })
    )
  })

  it('turns a number id into text', () => {
    expect(backupKey({ base: '/', userId: 'u1', type: 'post', id: 7 })).toBe(
      backupKey({ base: '/', userId: 'u1', type: 'post', id: '7' })
    )
  })
})

describe('isBackupKeyOf', () => {
  it('matches the user and the base path only', () => {
    expect(isBackupKeyOf(key('post', 'a'), '/', 'u1')).toBe(true)
    expect(isBackupKeyOf(key('post', null), '/', 'u1')).toBe(true)
    expect(isBackupKeyOf(key('post', 'a', 'u2'), '/', 'u1')).toBe(false)
    expect(isBackupKeyOf(key('post', 'a'), '/admin/', 'u1')).toBe(false)
  })

  it('refuses a key that is not a backup key', () => {
    expect(isBackupKeyOf('other:key', '/', 'u1')).toBe(false)
    expect(isBackupKeyOf('pluto:backup:not json', '/', 'u1')).toBe(false)
    expect(isBackupKeyOf('pluto:backup:["/","u1"]', '/', 'u1')).toBe(false)
  })
})

describe('the store: read and write', () => {
  it('writes and reads a record', () => {
    const storage = new FakeStorage()
    const store = make(storage)
    expect(store.write(key('post', 'a'), record())).toBe('ok')
    expect(store.read(key('post', 'a'))).toEqual(record())
  })

  it('reads null for a missing record', () => {
    expect(make(new FakeStorage()).read(key('post', 'a'))).toBeNull()
  })

  it('removes a broken text and an expired record on read', () => {
    const storage = new FakeStorage()
    const store = make(storage)
    storage.data.set(key('post', 'a'), '{not json')
    storage.data.set(
      key('post', 'b'),
      JSON.stringify(record({ savedAt: NOW - 15 * DAY }))
    )
    expect(store.read(key('post', 'a'))).toBeNull()
    expect(store.read(key('post', 'b'))).toBeNull()
    expect(storage.data.size).toBe(0)
  })

  it('removes a record', () => {
    const storage = new FakeStorage()
    const store = make(storage)
    store.write(key('post', 'a'), record())
    store.remove(key('post', 'a'))
    expect(store.read(key('post', 'a'))).toBeNull()
  })

  it('refuses a record over the size limit and keeps the old one', () => {
    const storage = new FakeStorage()
    const store = make(storage)
    store.write(key('post', 'a'), record())
    expect(store.write(key('post', 'a'), sized(2000))).toBe('too-large')
    expect(store.read(key('post', 'a'))).toEqual(record())
  })
})

describe('the store: limits', () => {
  it('removes the oldest backup of the user over the count limit', () => {
    const storage = new FakeStorage()
    const store = make(storage, { maxCount: 2 })
    store.write(key('post', 'a'), record({ savedAt: NOW - 3000 }))
    store.write(key('post', 'b'), record({ savedAt: NOW - 2000 }))
    store.write(key('post', 'c'), record({ savedAt: NOW - 1000 }))
    expect(store.read(key('post', 'a'))).toBeNull()
    expect(store.read(key('post', 'b'))).not.toBeNull()
    expect(store.read(key('post', 'c'))).not.toBeNull()
  })

  it('counts each user on its own', () => {
    const storage = new FakeStorage()
    const store = make(storage, { maxCount: 1 })
    store.write(key('post', 'a', 'u1'), record())
    store.write(key('post', 'a', 'u2'), record())
    expect(store.read(key('post', 'a', 'u1'))).not.toBeNull()
    expect(store.read(key('post', 'a', 'u2'))).not.toBeNull()
  })

  it('removes the oldest backups of the user to fit the total limit', () => {
    const storage = new FakeStorage()
    const store = make(storage, { maxChars: 1000, maxTotalChars: 2200 })
    store.write(key('post', 'a'), sized(700, NOW - 3000))
    store.write(key('post', 'b'), sized(700, NOW - 2000))
    expect(store.write(key('post', 'c'), sized(700, NOW - 1000))).toBe('ok')
    expect(store.read(key('post', 'a'))).toBeNull()
    expect(store.read(key('post', 'b'))).not.toBeNull()
    expect(store.read(key('post', 'c'))).not.toBeNull()
  })

  it('does not remove the backups of another user for the total limit', () => {
    const storage = new FakeStorage()
    const store = make(storage, { maxChars: 1000, maxTotalChars: 1500 })
    store.write(key('post', 'a', 'u2'), sized(700))
    expect(store.write(key('post', 'a', 'u1'), sized(700))).toBe('too-large')
    expect(store.read(key('post', 'a', 'u2'))).not.toBeNull()
  })

  it('prunes the expired backups of the user', () => {
    const storage = new FakeStorage()
    const store = make(storage)
    storage.data.set(
      key('post', 'old'),
      JSON.stringify(record({ savedAt: NOW - 20 * DAY }))
    )
    storage.data.set(key('post', 'bad'), 'nope')
    store.write(key('post', 'fresh'), record())
    store.prune('/', 'u1')
    expect([...storage.data.keys()]).toEqual([key('post', 'fresh')])
  })

  it('prunes a user over the count limit', () => {
    const storage = new FakeStorage()
    const store = make(storage, { maxCount: 1 })
    storage.data.set(
      key('post', 'a'),
      JSON.stringify(record({ savedAt: NOW - 2000 }))
    )
    storage.data.set(
      key('post', 'b'),
      JSON.stringify(record({ savedAt: NOW - 1000 }))
    )
    store.prune('/', 'u1')
    expect([...storage.data.keys()]).toEqual([key('post', 'b')])
  })
})

describe('the store: a full storage', () => {
  it('makes room and tries once more after a quota error', () => {
    const storage = new FakeStorage()
    const store = make(storage)
    store.write(key('post', 'a'), record({ savedAt: NOW - 2000 }))
    store.write(key('post', 'b'), record({ savedAt: NOW - 1000 }))
    storage.failWrites = 1
    expect(store.write(key('post', 'c'), record())).toBe('ok')
    expect(store.read(key('post', 'a'))).toBeNull()
    expect(store.read(key('post', 'b'))).not.toBeNull()
    expect(store.read(key('post', 'c'))).not.toBeNull()
  })

  it('gives quota when the second write fails too', () => {
    const storage = new FakeStorage()
    const store = make(storage)
    storage.failWrites = 2
    expect(store.write(key('post', 'a'), record())).toBe('quota')
  })

  it('does not throw when the storage is not available', () => {
    const storage = new FakeStorage()
    const store = make(storage)
    storage.broken = true
    expect(store.read(key('post', 'a'))).toBeNull()
    expect(store.write(key('post', 'a'), record())).toBe('quota')
    expect(() => store.prune('/', 'u1')).not.toThrow()
    expect(() => store.clearUser('/', 'u1')).not.toThrow()
  })
})

describe('clearUser', () => {
  it('removes only the backups of this user under this base path', () => {
    const storage = new FakeStorage()
    const store = make(storage)
    store.write(key('post', 'a'), record())
    store.write(key('post', null), record())
    store.write(key('post', 'a', 'u2'), record())
    storage.data.set('other:key', 'keep')
    storage.data.set(
      backupKey({ base: '/admin/', userId: 'u1', type: 'post', id: 'a' }),
      JSON.stringify(record())
    )
    store.clearUser('/', 'u1')
    expect([...storage.data.keys()].toSorted()).toEqual(
      [
        'other:key',
        key('post', 'a', 'u2'),
        backupKey({ base: '/admin/', userId: 'u1', type: 'post', id: 'a' }),
      ].toSorted()
    )
  })

  it('works without a store, for sign-out', () => {
    const storage = new FakeStorage()
    storage.data.set(key('post', 'a'), 'x')
    clearUserBackups(storage, '/', 'u1')
    expect(storage.data.size).toBe(0)
  })
})

describe('deviceId', () => {
  it('keeps the same id between calls', () => {
    const storage = new FakeStorage()
    let count = 0
    const first = deviceId(storage, () => `id-${++count}`)
    expect(deviceId(storage, () => `id-${++count}`)).toBe(first)
    expect(count).toBe(1)
  })

  it('gives an id when the storage is not available', () => {
    const storage = new FakeStorage()
    storage.broken = true
    expect(deviceId(storage, () => 'fresh')).toBe('fresh')
    expect(deviceId(null, () => 'fresh')).toBe('fresh')
  })

  it('is not removed by clearUser', () => {
    const storage = new FakeStorage()
    const id = deviceId(storage, () => 'device-1')
    clearUserBackups(storage, '/', 'u1')
    expect(deviceId(storage, () => 'device-2')).toBe(id)
  })
})

describe('the scheduler', () => {
  function fakeTimers() {
    let time = 0
    let next = 1
    const pending = new Map<number, { at: number; callback: () => void }>()
    return {
      timers: {
        now: () => time,
        setTimeout: (callback: () => void, ms: number) => {
          const id = next++
          pending.set(id, { at: time + ms, callback })
          return id
        },
        clearTimeout: (id: unknown) => {
          pending.delete(id as number)
        },
      },
      advance(ms: number) {
        const end = time + ms
        for (;;) {
          const due = [...pending.entries()]
            .filter(([, timer]) => timer.at <= end)
            .toSorted(([, a], [, b]) => a.at - b.at)[0]
          if (!due) {
            break
          }
          pending.delete(due[0])
          time = due[1].at
          due[1].callback()
        }
        time = end
      },
    }
  }

  it('runs once, `wait` after the last schedule', () => {
    const clock = fakeTimers()
    let runs = 0
    const scheduler = createBackupScheduler({
      wait: 1000,
      maxWait: 5000,
      run: () => runs++,
      timers: clock.timers,
    })
    scheduler.schedule()
    clock.advance(600)
    scheduler.schedule()
    clock.advance(600)
    expect(runs).toBe(0)
    clock.advance(400)
    expect(runs).toBe(1)
    expect(scheduler.pending).toBe(false)
  })

  it('runs at `maxWait` during a long burst', () => {
    const clock = fakeTimers()
    let runs = 0
    const scheduler = createBackupScheduler({
      wait: 1000,
      maxWait: 5000,
      run: () => runs++,
      timers: clock.timers,
    })
    for (let i = 0; i < 12; i++) {
      scheduler.schedule()
      clock.advance(500)
    }
    expect(runs).toBe(1)
    clock.advance(1000)
    expect(runs).toBe(2)
  })

  it('uses a slow timing for the server copy too', () => {
    const clock = fakeTimers()
    let runs = 0
    const scheduler = createBackupScheduler({
      wait: 10_000,
      maxWait: 30_000,
      run: () => runs++,
      timers: clock.timers,
    })
    scheduler.schedule()
    clock.advance(9000)
    expect(runs).toBe(0)
    clock.advance(1000)
    expect(runs).toBe(1)
  })

  it('flushes a waiting run at once, and does nothing when none waits', () => {
    const clock = fakeTimers()
    let runs = 0
    const scheduler = createBackupScheduler({
      wait: 1000,
      maxWait: 5000,
      run: () => runs++,
      timers: clock.timers,
    })
    scheduler.flush()
    expect(runs).toBe(0)
    scheduler.schedule()
    scheduler.flush()
    expect(runs).toBe(1)
    clock.advance(5000)
    expect(runs).toBe(1)
  })

  it('cancels a waiting run', () => {
    const clock = fakeTimers()
    let runs = 0
    const scheduler = createBackupScheduler({
      wait: 1000,
      maxWait: 5000,
      run: () => runs++,
      timers: clock.timers,
    })
    scheduler.schedule()
    scheduler.cancel()
    clock.advance(5000)
    expect(runs).toBe(0)
    expect(scheduler.pending).toBe(false)
  })
})
