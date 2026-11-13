import type { MessageParams } from './i18n-core'

export const DEFAULT_ERROR_KEY = 'pluto.errors.unknown'

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

function findTag(data: Record<string, unknown> | undefined):
  | {
      key: string
      params?: MessageParams
    }
  | undefined {
  for (const candidate of [
    asRecord(data?.i18n),
    asRecord(asRecord(data?.data)?.i18n),
  ]) {
    if (candidate && typeof candidate.key === 'string') {
      return { key: candidate.key, params: asRecord(candidate.params) }
    }
  }
  return undefined
}

export function errorKey(error: unknown): string | undefined {
  return findTag(asRecord(asRecord(error)?.data))?.key
}

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

  const server =
    nonEmpty(data?.statusMessage) ??
    nonEmpty(data?.message) ??
    nonEmpty(source?.statusMessage)
  return server ?? i18n.t(fallbackKey)
}
