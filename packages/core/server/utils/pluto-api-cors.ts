import type { H3Event } from 'h3'
import type { PlutoApiConfig } from './pluto-api-options'
import { getRequestHeader, setResponseHeader, setResponseStatus } from 'h3'
import { PLUTO_API_PREFIX } from '../../shared/utils/public-api'
import { getPlutoApiConfig } from './pluto-api-config'

export function isPlutoApiPath(path: string): boolean {
  const pathname = path.split('?')[0] ?? ''
  return (
    pathname === PLUTO_API_PREFIX || pathname.startsWith(`${PLUTO_API_PREFIX}/`)
  )
}

// The public API is read-only: allow GET, HEAD and OPTIONS only, and never credentials.
export function plutoApiCorsHeaders(
  origin: string | undefined,
  cors: PlutoApiConfig['cors']
): Record<string, string> {
  if (cors === false || (Array.isArray(cors) && cors.length === 0)) {
    return {}
  }
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept, Content-Type',
    'Access-Control-Max-Age': '86400',
  }
  if (cors === true) {
    headers['Access-Control-Allow-Origin'] = '*'
    return headers
  }
  headers.Vary = 'Origin'
  if (origin && cors.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  return headers
}

export function handlePlutoApiCors(event: H3Event): boolean {
  if (!isPlutoApiPath(event.path)) {
    return false
  }
  const headers = plutoApiCorsHeaders(
    getRequestHeader(event, 'origin'),
    getPlutoApiConfig().cors
  )
  for (const [name, value] of Object.entries(headers)) {
    setResponseHeader(event, name, value)
  }
  if (event.method === 'OPTIONS') {
    setResponseStatus(event, 204)
    return true
  }
  return false
}
