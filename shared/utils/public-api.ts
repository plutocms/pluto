import type { PlutoPublicQuery } from '../types/public-api'

/** The prefix of the public API. Version 1. A breaking change ships as `/api/pluto/v2` next to it. */
export const PLUTO_API_PREFIX = '/api/pluto/v1'

/**
 * The path of a public content route: the list of `type`, or one item when `id` is set. Each
 * segment of a nested id (`1.start/2.install`) is encoded on its own, so the slashes stay.
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
