import type { H3Event } from 'h3'

const PUBLIC_READ_KEY = 'plutoPublicRead'

/**
 * Marks the request as a public read. The content adapter of the CMS then
 * treats the caller as anonymous: it never reads the session cookie, shows
 * published items only, and the answer does not depend on who asks. A layer
 * that serves public pages from the content store calls this first, in
 * every route handler. Nitro auto-imports it.
 *
 * Without the CMS this does nothing: no adapter reads the mark.
 *
 * @see https://pluto.vulmix.dev/docs/build/public-api
 */
export function markPublicRead(event: H3Event): void {
  event.context[PUBLIC_READ_KEY] = true
}

/** True after `markPublicRead` ran for this request. */
export function isPublicRead(event: H3Event): boolean {
  return event.context[PUBLIC_READ_KEY] === true
}
