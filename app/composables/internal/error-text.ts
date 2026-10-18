// Pure part of `usePlutoErrorText`. It does not use Nuxt auto-imports.
import type { MessageParams } from './i18n-core'

/** The fallback key when the caller passes none. */
export const DEFAULT_ERROR_KEY = 'pluto.errors.unknown'

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

/**
 * Finds the `{ key, params }` that a `createPlutoError` call put in the
 * response. A `$fetch` error holds the whole response body in `data`, so the
 * pair sits in `data.data.i18n`. An error that Nuxt creates on the client
 * holds it in `data.i18n`.
 */
function findTag(data: Record<string, unknown> | undefined): {
 key: string
params?: MessageParams
} | undefined {
  for (const candidate of [asRecord(data?.i18n), asRecord(asRecord(data?.data)?.i18n)]) {
    if (candidate && typeof candidate.key === 'string') {
      return { key: candidate.key, params: asRecord(candidate.params) }
    }
  }
  return undefined
}

/**
 * Turns an error into text for an admin. Order:
 *
 * 1. The translated `data.i18n` of a server `createPlutoError`.
 * 2. The server `statusMessage`, then the server `message` (English).
 * 3. The translated fallback key.
 */
export function resolveErrorText(
  error: unknown,
  fallbackKey: string,
  i18n: {
 t: (key: string, params?: MessageParams) => string
te: (key: string) => boolean
}
): string {
  const source = asRecord(error)
  const data = asRecord(source?.data)

  const tag = findTag(data)
  if (tag && i18n.te(tag.key)) {
    return i18n.t(tag.key, tag.params)
  }

  const server = nonEmpty(source?.statusMessage) ?? nonEmpty(data?.statusMessage) ?? nonEmpty(data?.message)
  return server ?? i18n.t(fallbackKey)
}
