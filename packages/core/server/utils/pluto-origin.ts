import type { H3Event } from 'h3'
import { getRequestHeader } from 'h3'
import { createPlutoError } from './pluto-error'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const API_PREFIX = '/api/_pluto'

function hostOfUrl(value: string): string | undefined {
  try {
    const url = new URL(value)
    return url.host.toLowerCase()
  } catch {
    return undefined
  }
}

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
  host: string | undefined
  origin: string | undefined
  referer: string | undefined
}

// Compare the Host header, not x-forwarded-host: a client can fake that header.
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
