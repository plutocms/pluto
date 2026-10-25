import type { H3Event } from 'h3'
import type { PlutoMailErrorCode } from '../../shared/types/mail'
import { createHash } from 'node:crypto'
import { getRequestHeader, getRequestHost, getRequestIP, setResponseHeader } from 'h3'
import { isPlutoMailError, PlutoMailError } from '../mail/errors'
import { createResendClient } from '../mail/resend-client'
import { getContentAdapter } from './pluto-content'
import { createPlutoError } from './pluto-error'
import { resolveMailDriver } from './pluto-mail'

/**
 * Helpers for the admin-only mail routes under `server/api/_pluto/mail/**`.
 * The routes are thin. The logic lives in `pluto-mail-handlers.ts`, so a test
 * can call it without a Nitro server.
 */

function forbidden() {
  return createPlutoError({
    statusCode: 403,
    message: 'Only an administrator can do this.',
    key: 'pluto.errors.forbidden',
  })
}

/**
 * Lets only an administrator through, and fails closed. It denies the call
 * when no content adapter is registered, when the adapter has no
 * `authorize`, and when `authorize(event, '*')` throws or does anything but
 * resolve. A state-changing call (`write`) also needs a same-origin request.
 *
 * Mail routes differ from the content routes on purpose: the content routes
 * fail open without `authorize` (the backing store is the real gate). Mail
 * has no backing store, and its routes use the server's secrets, so no
 * guard means no access.
 */
export async function requireMailAdmin(event: H3Event, options: {
 write?: boolean
} = {}): Promise<void> {
  const adapter = getContentAdapter()
  if (!adapter?.authorize) {
    throw forbidden()
  }

  if (options.write) {
    assertMailSameOrigin(event)
  }

  try {
    await adapter.authorize(event, '*')
  } catch (error) {
    const status = (error as {
 statusCode?: number
} | null)?.statusCode
    // Keep a 401 so the admin can ask for a new sign-in. Everything else is a 403.
    throw status === 401
      ? createPlutoError({ statusCode: 401, message: 'Sign in to continue.', key: 'pluto.errors.unauthorized' })
      : forbidden()
  }
}

/**
 * Refuses a request that a browser sent from another site. A browser sets
 * `Origin` (or `Sec-Fetch-Site`) on a cross-site POST. A call with neither
 * header is not a browser form post, so it passes. The session cookie is
 * `SameSite=Lax` too: this is a second guard.
 */
export function assertMailSameOrigin(event: H3Event): void {
  if (getRequestHeader(event, 'sec-fetch-site') === 'cross-site') {
    throw forbidden()
  }

  const origin = getRequestHeader(event, 'origin')
  if (!origin) {
    return
  }

  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    throw forbidden()
  }

  if (originHost !== getRequestHost(event, { xForwardedHost: true })) {
    throw forbidden()
  }
}

const STATUS_BY_CODE: Record<PlutoMailErrorCode, number> = {
  not_configured: 409,
  invalid_key: 400,
  restricted_key: 400,
  test_sender_only: 400,
  domain_not_verified: 400,
  invalid_message: 400,
  rate_limited: 429,
  quota_exceeded: 429,
  timeout: 504,
  network: 502,
  provider_error: 502,
}

/** Turns a `PlutoMailError` into an H3 error that the admin shows in its language. */
export function toMailH3Error(error: PlutoMailError) {
  return createPlutoError({
    statusCode: STATUS_BY_CODE[error.code] ?? 502,
    message: error.message,
    key: `pluto.mail.errors.${error.code}`,
    data: { mail: { code: error.code, providerCode: error.providerCode } },
  })
}

/** Runs `fn` and turns a `PlutoMailError` it throws into an H3 error. Other errors pass through. */
export async function withMailErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    throw isPlutoMailError(error) ? toMailH3Error(error) : error
  }
}

/** Creates a Resend client from the key that resolves (env, then store). Throws `not_configured` with no key. */
export async function requireResendClient() {
  const { resendKey } = await resolveMailDriver()
  if (!resendKey) {
    throw new PlutoMailError('not_configured', 'The Resend API key is not set.')
  }
  return createResendClient({ apiKey: resendKey })
}

export interface MailRateLimiter {
  /** Counts one call. Returns the seconds to wait when the key is over the limit, or 0. */
  hit: (key: string) => number
}

/** A fixed-window counter in memory. Each server instance counts for itself. */
export function createMailRateLimiter(options: {
  limit: number
  windowMs: number
  now?: () => number
  maxKeys?: number
}): MailRateLimiter {
  const now = options.now ?? Date.now
  const maxKeys = options.maxKeys ?? 1000
  const windows = new Map<string, {
 start: number
count: number
}>()

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
      return current.count > options.limit ? Math.max(1, Math.ceil((current.start + options.windowMs - time) / 1000)) : 0
    },
  }
}

/**
 * Who is calling: a hash of the session credentials (the `Authorization`
 * header, else the cookies), so the limit counts for one admin session and no
 * secret sits in memory. With neither, it falls back to the IP address.
 */
export function adminRateKey(event: H3Event): string {
  const credentials = getRequestHeader(event, 'authorization') || getRequestHeader(event, 'cookie')
  if (credentials) {
    return `session:${createHash('sha256').update(credentials).digest('hex')}`
  }
  return `ip:${getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'}`
}

/** 5 test emails in 10 minutes for each admin. */
export const testMailLimiter = createMailRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 })

export function enforceTestMailRateLimit(event: H3Event, limiter: MailRateLimiter = testMailLimiter): void {
  const wait = limiter.hit(adminRateKey(event))
  if (wait > 0) {
    setResponseHeader(event, 'Retry-After', wait)
    throw createPlutoError({
      statusCode: 429,
      message: 'Too many test emails. Try again later.',
      key: 'pluto.mail.errors.testRateLimited',
      params: { minutes: Math.ceil(wait / 60) },
    })
  }
}
