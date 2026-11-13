import type { H3Event } from 'h3'
import type { PlutoMailErrorCode } from '../../shared/types/mail'
import { createHash } from 'node:crypto'
import {
  getRequestHeader,
  getRequestHost,
  getRequestIP,
  setResponseHeader,
} from 'h3'
import { isPlutoMailError, PlutoMailError } from '../mail/errors'
import { createResendClient } from '../mail/resend-client'
import { getContentAdapter } from './pluto-content'
import { createPlutoError } from './pluto-error'
import { resolveMailDriver } from './pluto-mail'

function forbidden() {
  return createPlutoError({
    statusCode: 403,
    message: 'Only an administrator can do this.',
    key: 'pluto.errors.forbidden',
  })
}

// Fail closed: deny when no adapter can authorize.
export async function requireMailAdmin(
  event: H3Event,
  options: {
    write?: boolean
  } = {}
): Promise<void> {
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
    const status = (
      error as {
        statusCode?: number
      } | null
    )?.statusCode
    throw status === 401
      ? createPlutoError({
          statusCode: 401,
          message: 'Sign in to continue.',
          key: 'pluto.errors.unauthorized',
        })
      : forbidden()
  }
}

// A cross-site request from a browser must not reach the mail routes.
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

export function toMailH3Error(error: PlutoMailError) {
  return createPlutoError({
    statusCode: STATUS_BY_CODE[error.code] ?? 502,
    message: error.message,
    key: `pluto.mail.errors.${error.code}`,
    data: { mail: { code: error.code, providerCode: error.providerCode } },
  })
}

export async function withMailErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    throw isPlutoMailError(error) ? toMailH3Error(error) : error
  }
}

export async function requireResendClient() {
  const { resendKey } = await resolveMailDriver()
  if (!resendKey) {
    throw new PlutoMailError('not_configured', 'The Resend API key is not set.')
  }
  return createResendClient({ apiKey: resendKey })
}

export interface MailRateLimiter {
  hit: (key: string) => number
}

export function createMailRateLimiter(options: {
  limit: number
  windowMs: number
  now?: () => number
  maxKeys?: number
}): MailRateLimiter {
  const now = options.now ?? Date.now
  const maxKeys = options.maxKeys ?? 1000
  const windows = new Map<
    string,
    {
      start: number
      count: number
    }
  >()

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

export function adminRateKey(event: H3Event): string {
  const credentials =
    getRequestHeader(event, 'authorization') ||
    getRequestHeader(event, 'cookie')
  if (credentials) {
    return `session:${createHash('sha256').update(credentials).digest('hex')}`
  }
  return `ip:${getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'}`
}

export const testMailLimiter = createMailRateLimiter({
  limit: 5,
  windowMs: 10 * 60 * 1000,
})

export function enforceTestMailRateLimit(
  event: H3Event,
  limiter: MailRateLimiter = testMailLimiter
): void {
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
