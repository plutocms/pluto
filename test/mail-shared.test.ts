import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createPlutoMailPoller,
  isPlutoMailAddress,
  isPlutoMailDomain,
  PLUTO_MAIL_POLL_LIMIT_MS,
  PLUTO_MAIL_REGIONS,
  plutoMailDomainState,
  plutoMailEnvLine,
  plutoMailErrorCode,
  plutoMailPollDelay,
} from '../shared/utils/mail'

describe('isPlutoMailAddress', () => {
  it('accepts a normal address', () => {
    for (const value of ['a@example.com', 'first.last+tag@mail.example.com.br']) {
      expect(isPlutoMailAddress(value), value).toBe(true)
    }
  })

  it('rejects a bad address', () => {
    for (const value of ['', 'a', 'a@b', 'a@@b.com', '@b.com', 'a@.com', 'a@b.', 'a b@c.com', 'a@b.com,c@d.com', 'Name <a@b.com>', `${'a'.repeat(250)}@b.com`]) {
      expect(isPlutoMailAddress(value), value).toBe(false)
    }
  })
})

describe('isPlutoMailDomain', () => {
  it('accepts a domain name', () => {
    for (const value of ['example.com', 'mail.example.com.br', 'a-b.co', 'xn--bcher-kva.example']) {
      expect(isPlutoMailDomain(value), value).toBe(true)
    }
  })

  it('rejects anything else', () => {
    for (const value of ['', 'example', 'Example.com', 'exa mple.com', 'https://example.com', 'example.com/x', '-a.com', 'a-.com', 'a..com', 'a.c', 'a.com:80', 'a.123', `${'a'.repeat(64)}.com`]) {
      expect(isPlutoMailDomain(value), value).toBe(false)
    }
  })
})

describe('pLUTO_MAIL_REGIONS', () => {
  it('starts with us-east-1 and has the Resend regions', () => {
    expect(PLUTO_MAIL_REGIONS[0]).toBe('us-east-1')
    expect(PLUTO_MAIL_REGIONS).toContain('sa-east-1')
  })
})

describe('plutoMailEnvLine', () => {
  it('leaves a simple value as it is', () => {
    expect(plutoMailEnvLine('NUXT_PLUTO_MAIL_DRIVER', 'resend')).toBe('NUXT_PLUTO_MAIL_DRIVER=resend')
    expect(plutoMailEnvLine('NUXT_PLUTO_MAIL_FROM', 'hello@example.com')).toBe('NUXT_PLUTO_MAIL_FROM=hello@example.com')
  })

  it('quotes a value with spaces or angle brackets', () => {
    expect(plutoMailEnvLine('NUXT_PLUTO_MAIL_FROM', 'Shop <hello@example.com>')).toBe('NUXT_PLUTO_MAIL_FROM="Shop <hello@example.com>"')
  })

  it('escapes a quote and a backslash', () => {
    expect(plutoMailEnvLine('X', 'a "b" \\c')).toBe('X="a \\"b\\" \\\\c"')
  })

  it('quotes an empty-looking placeholder safely', () => {
    expect(plutoMailEnvLine('X', '')).toBe('X=')
    expect(plutoMailEnvLine('X', '$HOME')).toBe('X="$HOME"')
  })
})

describe('plutoMailDomainState', () => {
  it('groups the Resend statuses', () => {
    expect(plutoMailDomainState('verified')).toBe('verified')
    expect(plutoMailDomainState('failed')).toBe('failed')
    expect(plutoMailDomainState('partially_failed')).toBe('failed')
    for (const status of ['not_started', 'pending', 'partially_verified', 'temporary_failure', 'something_new']) {
      expect(plutoMailDomainState(status), status).toBe('pending')
    }
  })
})

describe('plutoMailPollDelay', () => {
  it('starts at 10 seconds and slows down to 60 seconds', () => {
    expect(plutoMailPollDelay(0)).toBe(10_000)
    expect(plutoMailPollDelay(59_999)).toBe(10_000)
    expect(plutoMailPollDelay(60_000)).toBe(20_000)
    expect(plutoMailPollDelay(180_000)).toBe(30_000)
    expect(plutoMailPollDelay(300_000)).toBe(60_000)
    expect(plutoMailPollDelay(599_999)).toBe(60_000)
  })

  it('stops after 10 minutes', () => {
    expect(PLUTO_MAIL_POLL_LIMIT_MS).toBe(600_000)
    expect(plutoMailPollDelay(600_000)).toBeNull()
    expect(plutoMailPollDelay(1_000_000)).toBeNull()
  })

  it('never waits less than 10 seconds or more than 60 seconds', () => {
    for (let elapsed = 0; elapsed < PLUTO_MAIL_POLL_LIMIT_MS; elapsed += 1000) {
      const delay = plutoMailPollDelay(elapsed)!
      expect(delay).toBeGreaterThanOrEqual(10_000)
      expect(delay).toBeLessThanOrEqual(60_000)
    }
  })
})

describe('plutoMailErrorCode', () => {
  it('reads the code of a $fetch error', () => {
    expect(plutoMailErrorCode({ data: { statusCode: 400, data: { mail: { code: 'test_sender_only' } } } })).toBe('test_sender_only')
  })

  it('reads the code of an error that Nuxt created', () => {
    expect(plutoMailErrorCode({ data: { mail: { code: 'invalid_key' } } })).toBe('invalid_key')
  })

  it('returns undefined for anything else', () => {
    for (const value of [undefined, null, 'text', {}, { data: {} }, { data: { data: { mail: {} } } }, { data: { mail: { code: 5 } } }]) {
      expect(plutoMailErrorCode(value)).toBeUndefined()
    }
  })
})

describe('createPlutoMailPoller', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('checks after 10 seconds, then stops when the check is done', async () => {
    vi.useFakeTimers()
    const check = vi.fn(async () => check.mock.calls.length >= 2)
    const onStop = vi.fn()
    const poller = createPlutoMailPoller({ check, onStop })

    poller.start()
    expect(poller.isRunning()).toBe(true)
    expect(check).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(9_999)
    expect(check).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(check).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(check).toHaveBeenCalledTimes(2)

    expect(onStop).toHaveBeenCalledWith('done')
    expect(poller.isRunning()).toBe(false)

    await vi.advanceTimersByTimeAsync(120_000)
    expect(check).toHaveBeenCalledTimes(2)
  })

  it('slows down and stops after 10 minutes', async () => {
    vi.useFakeTimers()
    const times: number[] = []
    const start = Date.now()
    const onStop = vi.fn()
    const poller = createPlutoMailPoller({
      check: async () => {
        times.push(Date.now() - start)
        return false
      },
      onStop,
    })

    poller.start()
    await vi.advanceTimersByTimeAsync(11 * 60 * 1000)

    expect(times.slice(0, 7)).toEqual([10_000, 20_000, 30_000, 40_000, 50_000, 60_000, 80_000])
    expect(times.at(-1)).toBeLessThanOrEqual(600_000)
    const gaps = times.slice(1).map((time, index) => time - times[index]!)
    expect(Math.max(...gaps)).toBe(60_000)
    expect(onStop).toHaveBeenCalledTimes(1)
    expect(onStop).toHaveBeenCalledWith('timeout')
    expect(poller.isRunning()).toBe(false)
  })

  it('keeps polling after a failed check', async () => {
    vi.useFakeTimers()
    const check = vi.fn(async () => {
      if (check.mock.calls.length === 1) {
        throw new Error('network')
      }
      return true
    })
    const onStop = vi.fn()

    createPlutoMailPoller({ check, onStop }).start()
    await vi.advanceTimersByTimeAsync(20_000)

    expect(check).toHaveBeenCalledTimes(2)
    expect(onStop).toHaveBeenCalledWith('done')
  })

  it('stops on request, even while a check waits', async () => {
    vi.useFakeTimers()
    let release: (value: boolean) => void = () => {}
    const check = vi.fn(() => new Promise<boolean>((resolve) => {
      release = resolve
    }))
    const onStop = vi.fn()
    const poller = createPlutoMailPoller({ check, onStop })

    poller.start()
    await vi.advanceTimersByTimeAsync(10_000)
    poller.stop()
    release(false)
    await vi.advanceTimersByTimeAsync(120_000)

    expect(check).toHaveBeenCalledTimes(1)
    expect(onStop).toHaveBeenCalledTimes(1)
    expect(onStop).toHaveBeenCalledWith('stopped')
  })

  it('start() again restarts the 10 minutes and ends the run before it', async () => {
    vi.useFakeTimers()
    const check = vi.fn(async () => false)
    const onStop = vi.fn()
    const poller = createPlutoMailPoller({ check, onStop })

    poller.start()
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
    poller.start()
    await vi.advanceTimersByTimeAsync(9 * 60 * 1000)

    expect(onStop).toHaveBeenCalledWith('stopped')
    expect(poller.isRunning()).toBe(true)
    poller.stop()
  })
})
