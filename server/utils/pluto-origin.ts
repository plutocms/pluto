import type { H3Event } from 'h3'
import { getRequestHeader } from 'h3'
import { createPlutoError } from './pluto-error'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const API_PREFIX = '/api/_pluto'

/** `host:port` of a URL in lowercase. The default port of the scheme is dropped. */
function hostOfUrl(value: string): string | undefined {
  try {
    const url = new URL(value)
    return url.host.toLowerCase()
  } catch {
    return undefined
  }
}

/** The `Host` header in lowercase. A default port is dropped, so `a.com:443` equals `a.com`. */
function normalizeHost(host: string, protocol: string): string {
  const lower = host.trim().toLowerCase()
  if (protocol === 'https:' && lower.endsWith(':443')) {
    return lower.slice(0, -':443'.length)
  }
  if (protocol === 'http:' && lower.endsWith(':80')) {
    return lower.slice(0, -':80'.length)
  }
  return lower
}

export interface PlutoOriginCheckInput {
  method: string
  path: string
  /** The request `Host` header. */
  host: string | undefined
  origin: string | undefined
  referer: string | undefined
}

/**
 * Decides if a request passes the CSRF check. Core runs it for every layer, with or without
 * the CMS (server/middleware/pluto-origin.ts). A request that can change
 * state (`POST`, `PATCH`, `PUT`, `DELETE`) to `/api/_pluto/**` must say it
 * comes from this host. `Origin` is checked first. When it is absent,
 * `Referer` is checked. With neither header, the request fails. The compared
 * value is `host:port`.
 *
 * The check uses the `Host` header. It does not use `x-forwarded-host`:
 * Nitro has no setting to trust a proxy, and a client can fake that header.
 * A proxy in front of the app must pass the public `Host` header on.
 */
export function isPlutoSameOriginRequest(
  input: PlutoOriginCheckInput
): boolean {
  if (SAFE_METHODS.has(input.method.toUpperCase())) {
    return true
  }
  const path = input.path.split('?')[0]!
  if (path !== API_PREFIX && !path.startsWith(`${API_PREFIX}/`)) {
    return true
  }
  const source = input.origin || input.referer
  if (!source || !input.host) {
    return false
  }
  let url: URL
  try {
    url = new URL(source)
  } catch {
    // `Origin: null` and other bad values come here.
    return false
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false
  }
  return hostOfUrl(source) === normalizeHost(input.host, url.protocol)
}

/** Throws a 403 when the request fails the origin check. */
export function assertPlutoSameOrigin(event: H3Event): void {
  const ok = isPlutoSameOriginRequest({
    method: event.method,
    path: event.path,
    host: getRequestHeader(event, 'host'),
    origin: getRequestHeader(event, 'origin'),
    referer: getRequestHeader(event, 'referer'),
  })
  if (!ok) {
    throw createPlutoError({
      statusCode: 403,
      message: 'This request did not come from this site.',
      key: 'pluto.errors.crossOrigin',
    })
  }
}
