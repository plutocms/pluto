import { verifyFormsToken } from './forms-token'

export interface PlutoFormsRateLimiter {
  hit: (key: string) => number
}

/**
 * A brake against a script: a window per key. `hit` returns 0 while the key is under the limit,
 * and the seconds to wait when it is over. The windows live in the memory of one server, so a
 * site with many servers has a limit for each one.
 */
export function createFormsRateLimiter(options: {
  limit: number
  windowMs: number
  now?: () => number
  maxKeys?: number
}): PlutoFormsRateLimiter {
  const now = options.now ?? Date.now
  const maxKeys = options.maxKeys ?? 10_000
  const windows = new Map<string, { start: number; count: number }>()

  return {
    hit(key) {
      const time = now()
      if (windows.size >= maxKeys) {
        for (const [name, window] of windows) {
          if (time - window.start >= options.windowMs) {
            windows.delete(name)
          }
        }
        if (windows.size >= maxKeys) {
          windows.delete(windows.keys().next().value as string)
        }
      }
      const current = windows.get(key)
      if (!current || time - current.start >= options.windowMs) {
        windows.set(key, { start: time, count: 1 })
        return 0
      }
      current.count++
      return current.count > options.limit
        ? Math.max(
            1,
            Math.ceil((current.start + options.windowMs - time) / 1000)
          )
        : 0
    },
  }
}

export const PLUTO_FORMS_TURNSTILE_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/** Asks Cloudflare if a Turnstile answer is good. A network error or a late answer is a no. */
export async function verifyFormsTurnstile(options: {
  secret: string
  response: unknown
  ip?: string
  fetch?: typeof fetch
}): Promise<boolean> {
  if (typeof options.response !== 'string' || !options.response) {
    return false
  }
  if (options.response.length > 2048) {
    return false
  }
  const body = new URLSearchParams({
    secret: options.secret,
    response: options.response,
  })
  if (options.ip) {
    body.set('remoteip', options.ip)
  }
  try {
    const answer = await (options.fetch ?? fetch)(PLUTO_FORMS_TURNSTILE_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5000),
    })
    if (!answer.ok) {
      return false
    }
    const result = (await answer.json()) as { success?: boolean }
    return result.success === true
  } catch {
    return false
  }
}

export type PlutoFormsSpamReason =
  | 'rate-limit'
  | 'honeypot'
  | 'invalid-token'
  | 'too-fast'
  | 'expired'
  | 'turnstile'

export type PlutoFormsSpamVerdict =
  | { ok: true }
  | { ok: false; reason: PlutoFormsSpamReason; retryAfter?: number }

export interface PlutoFormsSpamInput {
  handle: string
  ip: string
  /** The value of the honeypot field. A visitor leaves it empty. */
  honeypot: unknown
  token: unknown
  turnstileToken?: unknown
}

export interface PlutoFormsSpamOptions {
  secret: string
  limiter: PlutoFormsRateLimiter
  minFillMs?: number
  now?: number
  /** Set when Turnstile is on. */
  turnstileSecret?: string
  fetch?: typeof fetch
}

/**
 * The spam checks of one submission, in order: the rate limit of the IP, the honeypot, the signed
 * token (and its minimum fill time), and Turnstile when the site has keys. The first one that
 * fails gives the reason.
 * @see https://pluto.vulmix.dev/docs/build/forms
 */
export async function checkFormsSpam(
  input: PlutoFormsSpamInput,
  options: PlutoFormsSpamOptions
): Promise<PlutoFormsSpamVerdict> {
  const wait = options.limiter.hit(`${input.handle}:${input.ip}`)
  if (wait > 0) {
    return { ok: false, reason: 'rate-limit', retryAfter: wait }
  }

  if (input.honeypot !== undefined && input.honeypot !== '') {
    return { ok: false, reason: 'honeypot' }
  }

  const token = verifyFormsToken(options.secret, input.token, input.handle, {
    now: options.now,
    minAgeMs: options.minFillMs,
  })
  if (token === 'invalid') {
    return { ok: false, reason: 'invalid-token' }
  }
  if (token !== 'ok') {
    return { ok: false, reason: token }
  }

  if (options.turnstileSecret) {
    const good = await verifyFormsTurnstile({
      secret: options.turnstileSecret,
      response: input.turnstileToken,
      ip: input.ip === 'unknown' ? undefined : input.ip,
      fetch: options.fetch,
    })
    if (!good) {
      return { ok: false, reason: 'turnstile' }
    }
  }

  return { ok: true }
}
