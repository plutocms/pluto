import type {
  BackupAnswer,
  BackupRequest,
} from '../app/composables/internal/content-backup-sync'
import type { PlutoContentBackup } from '../shared/utils/content-backup'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createBackupSync,
  errorStatus,
} from '../app/composables/internal/content-backup-sync'

function record(value: unknown, extra: Partial<PlutoContentBackup> = {}) {
  return {
    v: 1,
    savedAt: 1,
    device: 'd',
    tab: 't',
    changes: { title: { base: 'a', value } },
    ...extra,
  } as PlutoContentBackup
}

function setup(
  answer: (method: string) => BackupAnswer | Promise<BackupAnswer>
) {
  const calls: string[] = []
  const request: BackupRequest = async (method, key) => {
    calls.push(`${method} ${key}`)
    return answer(method)
  }
  const sendKeepalive = vi.fn()
  return {
    sync: createBackupSync({ request, sendKeepalive }),
    calls,
    sendKeepalive,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('errorStatus', () => {
  it('reads the status of a $fetch error and of a fetch response', () => {
    expect(errorStatus({ statusCode: 413 })).toBe(413)
    expect(errorStatus({ status: 401 })).toBe(401)
    expect(errorStatus({ response: { status: 403 } })).toBe(403)
    expect(errorStatus(new Error('x'))).toBeUndefined()
    expect(errorStatus(null)).toBeUndefined()
  })
})

describe('createBackupSync', () => {
  it('reads the record of the server', async () => {
    const stored = record('b')
    const { sync } = setup(() => ({ supported: true, backup: stored }))

    expect(await sync.read('a')).toEqual(stored)
    expect(sync.supported).toBe(true)
  })

  it('sends nothing after a GET answers supported: false', async () => {
    const { sync, calls, sendKeepalive } = setup(() => ({ supported: false }))

    expect(await sync.read('a')).toBeNull()
    expect(sync.supported).toBe(false)
    await sync.write('a', record('b'))
    await sync.remove('a')
    sync.keepalive('a', record('b'), '{}')
    expect(calls).toEqual(['GET a'])
    expect(sendKeepalive).not.toHaveBeenCalled()
  })

  it('skips a record equal to the last one sent', async () => {
    const { sync, calls } = setup(() => ({ supported: true }))

    await sync.write('a', record('b'))
    // Only the time and the tab differ.
    await sync.write('a', record('b', { savedAt: 99, tab: 'other' }))
    await sync.write('a', record('c'))
    await sync.write('b', record('c'))

    expect(calls).toEqual(['PUT a', 'PUT a', 'PUT b'])
  })

  it('sends again after a remove or forget', async () => {
    const { sync, calls } = setup(() => ({ supported: true }))

    await sync.write('a', record('b'))
    await sync.remove('a')
    await sync.write('a', record('b'))
    sync.forget()
    await sync.write('a', record('b'))

    expect(calls).toEqual(['PUT a', 'DELETE a', 'PUT a', 'PUT a'])
  })

  it('reports otherDevice from the answer', async () => {
    const { sync } = setup(() => ({ supported: true, otherDevice: true }))

    expect(await sync.write('a', record('b'))).toEqual({ otherDevice: true })
  })

  it('runs one write at a time, in order', async () => {
    const order: string[] = []
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const request: BackupRequest = async (method, _key, body) => {
      order.push(`start ${JSON.stringify(body?.changes.title?.value)}`)
      if (order.length === 1) {
        await gate
      }
      order.push('end')
      return { supported: true }
    }
    const sync = createBackupSync({ request, sendKeepalive: vi.fn() })

    const first = sync.write('a', record('one'))
    const second = sync.write('a', record('two'))
    await Promise.resolve()
    expect(order).toEqual(['start "one"'])
    release()
    await Promise.all([first, second])

    expect(order).toEqual(['start "one"', 'end', 'start "two"', 'end'])
  })

  it('stops for the page view on a 401, 403 or 413', async () => {
    for (const statusCode of [401, 403, 413]) {
      const { sync, calls } = setup(() => {
        throw Object.assign(new Error('refused'), { statusCode })
      })

      await sync.write('a', record('b'))
      expect(sync.halted, String(statusCode)).toBe(true)
      await sync.write('a', record('c'))
      await sync.remove('a')
      expect(await sync.read('a')).toBeNull()
      expect(calls, String(statusCode)).toEqual(['PUT a'])
    }
  })

  it('tries again after another error', async () => {
    let fail = true
    const { sync, calls } = setup(() => {
      if (fail) {
        throw Object.assign(new Error('down'), { statusCode: 500 })
      }
      return { supported: true }
    })

    expect(await sync.write('a', record('b'))).toEqual({ otherDevice: false })
    expect(sync.halted).toBe(false)
    fail = false
    await sync.write('a', record('b'))

    expect(calls).toEqual(['PUT a', 'PUT a'])
  })

  it('sends a keepalive body once for the same record', () => {
    const { sync, sendKeepalive } = setup(() => ({ supported: true }))

    sync.keepalive('a', record('b'), '{"body":1}')
    sync.keepalive('a', record('b'), '{"body":1}')
    sync.keepalive('a', record('c'), '{"body":2}')

    expect(sendKeepalive.mock.calls).toEqual([
      ['a', '{"body":1}'],
      ['a', '{"body":2}'],
    ])
  })

  it('waits for a write in progress, at most the time given', async () => {
    vi.useFakeTimers()
    const { sync } = setup(() => new Promise<BackupAnswer>(() => {}))

    // No write: no wait.
    await sync.settled(2000)

    void sync.write('a', record('b'))
    let done = false
    void sync.settled(2000).then(() => (done = true))
    await vi.advanceTimersByTimeAsync(1999)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(2)
    expect(done).toBe(true)
  })

  it('settled returns when the write ends', async () => {
    let release!: () => void
    const { sync } = setup(
      () =>
        new Promise<BackupAnswer>((resolve) => {
          release = () => resolve({ supported: true })
        })
    )

    const write = sync.write('a', record('b'))
    let done = false
    void sync.settled(60_000).then(() => (done = true))
    await Promise.resolve()
    expect(done).toBe(false)
    release()
    await write
    await Promise.resolve()
    expect(done).toBe(true)
  })
})
