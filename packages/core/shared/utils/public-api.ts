import type { PlutoPublicItem, PlutoPublicQuery } from '../types/public-api'

export const PLUTO_API_PREFIX = '/api/pluto/v1'

export function plutoSurroundApiPath(
  type: string,
  id: string | number
): string {
  return `${PLUTO_API_PREFIX}/surround/${encodeURIComponent(type)}/${String(id).split('/').map(encodeURIComponent).join('/')}`
}

/**
 * The path of a public content route: the list of `type`, or one item when `id` is set.
 * @see https://pluto.vulmix.dev/docs/build/public-api#routes
 */
export function plutoContentApiPath(
  type: string,
  id?: string | number
): string {
  const base = `${PLUTO_API_PREFIX}/content/${encodeURIComponent(type)}`
  if (id === undefined || id === '') {
    return base
  }
  return `${base}/${String(id).split('/').map(encodeURIComponent).join('/')}`
}

/** The URL query of a list route, as `fetch` and `useFetch` take it. `filter` becomes `filter[field]`. */
export function plutoPublicQueryParams(
  query: PlutoPublicQuery = {}
): Record<string, string> {
  const params: Record<string, string> = {}
  if (query.limit !== undefined) {
    params.limit = String(query.limit)
  }
  if (query.offset !== undefined) {
    params.offset = String(query.offset)
  }
  if (query.search) {
    params.search = query.search
  }
  if (query.sort) {
    params.sort = query.sort
  }
  for (const [field, value] of Object.entries(query.filter ?? {})) {
    params[`filter[${field}]`] = String(value)
  }
  return params
}

/** The options of `formatPublishedDate`: `Intl.DateTimeFormat` options and a locale. */
export interface PlutoPublishedDateOptions extends Intl.DateTimeFormatOptions {
  /** Default `'en'`. */
  locale?: string
}

/**
 * The date of a public item, as text: `publishedAt`, else `createdAt`, else `''`. Default
 * `{ dateStyle: 'medium', timeZone: 'UTC' }`: the server and the browser give the same text, so
 * the page hydrates with no mismatch. Pass `timeZone` for the time zone of the site.
 * @see https://pluto.vulmix.dev/docs/build/public-api#dates-and-reading-time
 */
export function formatPublishedDate(
  item: Pick<PlutoPublicItem, 'createdAt' | 'publishedAt'>,
  { locale = 'en', timeZone = 'UTC', ...format }: PlutoPublishedDateOptions = {}
): string {
  const value = item.publishedAt || item.createdAt
  const date = value ? new Date(value) : undefined
  if (!date || Number.isNaN(date.getTime())) {
    return ''
  }
  return new Intl.DateTimeFormat(locale, {
    ...(Object.keys(format).length ? format : { dateStyle: 'medium' }),
    timeZone,
  }).format(date)
}

/**
 * The reading time of an HTML body, in minutes: its words over `wordsPerMinute` (default 220),
 * rounded, at least 1. The tags do not count as words.
 * @see https://pluto.vulmix.dev/docs/build/public-api#dates-and-reading-time
 */
export function readingMinutes(html: string, wordsPerMinute = 220): number {
  const words = html
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length
  return Math.max(1, Math.round(words / wordsPerMinute))
}
