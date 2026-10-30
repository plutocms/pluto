import type { H3Event } from 'h3'
import { getRequestIP, setResponseHeader } from 'h3'
import { createPlutoError } from '../../../../../server/utils/pluto-error'

export interface RateLimiter {
  /** Counts one request. Returns the seconds to wait when the key is over the limit, or 0. */
  hit: (key: string) => number
}

/**
 * A fixed-window counter in memory. Each server instance keeps its own
 * counts. It is a brake against a script that hammers the sign-in routes. It
 * is not a security boundary: OAuth state, PKCE and GitHub itself guard the
 * flow.
 */
export function createRateLimiter(options: {
  limit: number
  windowMs: number
  now?: () => number
  maxKeys?: number
}): RateLimiter {
  const now = options.now ?? Date.now
  const maxKeys = options.maxKeys ?? 10_000
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
        // Drop the windows that ended. If all are live, drop the oldest.
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

const authLimiter = createRateLimiter({ limit: 20, windowMs: 60_000 })

/**
 * Limits the sign-in routes to 20 requests a minute for each IP. The IP comes
 * from the socket, or from `x-forwarded-for` when a proxy sets it. A client
 * can fake that header, so this stays a brake and not a gate.
 */
export function enforceAuthRateLimit(
  event: H3Event,
  limiter: RateLimiter = authLimiter
): void {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const wait = limiter.hit(ip)
  if (wait > 0) {
    setResponseHeader(event, 'Retry-After', wait)
    throw createPlutoError({
      statusCode: 429,
      message: 'Too many sign-in requests. Try again soon.',
      key: 'pluto.github.errors.tooManyRequests',
    })
  }
}
