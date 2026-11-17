import { describe, expect, it, vi } from 'vitest'
import { readFormsConfig } from '../server/utils/forms-config'
import {
  checkFormsSpam,
  createFormsRateLimiter,
  verifyFormsTurnstile,
} from '../server/utils/forms-spam'
import { signFormsToken, verifyFormsToken } from '../server/utils/forms-token'

const SECRET = 'a-long-secret-for-the-tests'

const BASE = 1_700_000_000_000

function options(extra: Record<string, unknown> = {}) {
  return {
    secret: SECRET,
    limiter: createFormsRateLimiter({ limit: 5, windowMs: 60_000 }),
    now: BASE + 10_000,
    ...extra,
  }
}

function input(extra: Record<string, unknown> = {}) {
  return {
    handle: 'contact',
    ip: '203.0.113.1',
    honeypot: '',
    token: signFormsToken(SECRET, 'contact', BASE),
    ...extra,
  }
}

describe('the signed token', () => {
  it('accepts a token that is old enough', () => {
    const token = signFormsToken(SECRET, 'contact', BASE)

    expect(verifyFormsToken(SECRET, token, 'contact', { now: BASE + 5000 })).toBe('ok')
  })

  it('says too-fast under the minimum fill time', () => {
    const token = signFormsToken(SECRET, 'contact', BASE)

    expect(verifyFormsToken(SECRET, token, 'contact', { now: BASE + 500 })).toBe('too-fast')
  })

  it('says expired after a day', () => {
    const token = signFormsToken(SECRET, 'contact', BASE)

    expect(
      verifyFormsToken(SECRET, token, 'contact', { now: BASE + 25 * 3600_000 })
    ).toBe('expired')
  })

  it('refuses a bad token', () => {
    const token = signFormsToken(SECRET, 'contact', BASE)
    const later = { now: BASE + 5000 }

    expect(verifyFormsToken(SECRET, undefined, 'contact', later)).toBe('invalid')
    expect(verifyFormsToken(SECRET, 'abc', 'contact', later)).toBe('invalid')
    expect(verifyFormsToken(SECRET, `${token}x`, 'contact', later)).toBe('invalid')
    expect(verifyFormsToken('other-secret', token, 'contact', later)).toBe('invalid')
    expect(verifyFormsToken(SECRET, token, 'other', later)).toBe('invalid')
    expect(verifyFormsToken('', token, 'contact', later)).toBe('invalid')
  })
})

describe('the rate limiter', () => {
  it('lets the limit through and then says how long to wait', () => {
    let time = 0
    const limiter = createFormsRateLimiter({
      limit: 2,
      windowMs: 60_000,
      now: () => time,
    })

    expect(limiter.hit('a')).toBe(0)
    expect(limiter.hit('a')).toBe(0)
    expect(limiter.hit('a')).toBe(60)
    expect(limiter.hit('b')).toBe(0)
    time = 61_000
    expect(limiter.hit('a')).toBe(0)
  })
})

describe('checkFormsSpam', () => {
  it('passes a clean submission', async () => {
    expect(await checkFormsSpam(input(), options())).toEqual({ ok: true })
  })

  it('catches the honeypot', async () => {
    expect(await checkFormsSpam(input({ honeypot: 'http://spam' }), options())).toEqual({
      ok: false,
      reason: 'honeypot',
    })
  })

  it('catches a form sent too fast', async () => {
    expect(await checkFormsSpam(input(), options({ now: BASE + 1000 }))).toEqual({
      ok: false,
      reason: 'too-fast',
    })
  })

  it('catches a token of another form, a bad one and a missing one', async () => {
    for (const token of [
      signFormsToken(SECRET, 'other', BASE),
      'bad',
      undefined,
    ]) {
      expect(await checkFormsSpam(input({ token }), options())).toEqual({
        ok: false,
        reason: 'invalid-token',
      })
    }
  })

  it('catches an expired token', async () => {
    const verdict = await checkFormsSpam(
      input(),
      options({ now: BASE + 48 * 3600_000 })
    )

    expect(verdict).toEqual({ ok: false, reason: 'expired' })
  })

  it('limits the submissions of one IP', async () => {
    const shared = options()
    const verdicts = []
    for (let index = 0; index < 7; index++) {
      verdicts.push(await checkFormsSpam(input(), shared))
    }

    expect(verdicts.slice(0, 5).every((verdict) => verdict.ok)).toBe(true)
    expect(verdicts[5]).toMatchObject({ ok: false, reason: 'rate-limit' })
    expect(await checkFormsSpam(input({ ip: '203.0.113.2' }), shared)).toEqual({
      ok: true,
    })
  })

  it('asks Cloudflare when Turnstile is on', async () => {
    const good = vi.fn(async () => Response.json({ success: true }))
    const bad = vi.fn(async () => Response.json({ success: false }))

    expect(
      await checkFormsSpam(
        input({ turnstileToken: 'cf-token' }),
        options({ turnstileSecret: 's', fetch: good })
      )
    ).toEqual({ ok: true })
    expect(good).toHaveBeenCalledOnce()
    expect(
      await checkFormsSpam(
        input({ turnstileToken: 'cf-token' }),
        options({ turnstileSecret: 's', fetch: bad })
      )
    ).toEqual({ ok: false, reason: 'turnstile' })
    expect(
      await checkFormsSpam(input(), options({ turnstileSecret: 's', fetch: good }))
    ).toEqual({ ok: false, reason: 'turnstile' })
  })

  it('does not call Cloudflare when Turnstile is off', async () => {
    const fetcher = vi.fn()

    await checkFormsSpam(input(), options({ fetch: fetcher }))

    expect(fetcher).not.toHaveBeenCalled()
  })
})

describe('verifyFormsTurnstile', () => {
  it('sends the secret, the answer and the IP', async () => {
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = init?.body as URLSearchParams
      expect(body.get('secret')).toBe('s')
      expect(body.get('response')).toBe('r')
      expect(body.get('remoteip')).toBe('1.2.3.4')
      return Response.json({ success: true })
    })

    expect(
      await verifyFormsTurnstile({
        secret: 's',
        response: 'r',
        ip: '1.2.3.4',
        fetch: fetcher as unknown as typeof fetch,
      })
    ).toBe(true)
  })

  it('says no on a network error or a bad status', async () => {
    const down = vi.fn(async () => {
      throw new Error('down')
    })
    const broken = vi.fn(async () => new Response('x', { status: 500 }))

    expect(await verifyFormsTurnstile({ secret: 's', response: 'r', fetch: down })).toBe(false)
    expect(await verifyFormsTurnstile({ secret: 's', response: 'r', fetch: broken })).toBe(false)
    expect(await verifyFormsTurnstile({ secret: 's', response: '' })).toBe(false)
  })
})

describe('readFormsConfig', () => {
  it('uses the secret of the environment first', () => {
    const config = readFormsConfig(
      { secret: ' abc ' },
      { githubSessionPassword: 'x'.repeat(40), dev: false }
    )

    expect(config).toMatchObject({ secret: 'abc', secretSource: 'env' })
  })

  it('derives a key from the session password of the CMS', () => {
    const config = readFormsConfig({}, { githubSessionPassword: 'x'.repeat(40), dev: false })

    expect(config.secretSource).toBe('github')
    expect(config.secret).toHaveLength(64)
    expect(config.secret).not.toContain('xxxx')
  })

  it('makes a secret in development only', () => {
    expect(readFormsConfig({}, { dev: true }).secretSource).toBe('dev')
    expect(readFormsConfig({}, { dev: false })).toMatchObject({
      secret: '',
      secretSource: 'none',
    })
  })

  it('reads the numbers with defaults', () => {
    expect(readFormsConfig({}, { dev: false })).toMatchObject({
      minFillMs: 3000,
      rateLimit: 5,
    })
    expect(
      readFormsConfig({ minFillSeconds: '1.5', rateLimit: '9' }, { dev: false })
    ).toMatchObject({ minFillMs: 1500, rateLimit: 9 })
  })
})
