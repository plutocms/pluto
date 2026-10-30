import { defineEventHandler } from 'h3'
import { assertPlutoSameOrigin } from '../utils/pluto-origin'

/**
 * Blocks a cross-site request that would change state on `/api/_pluto/**`, for every layer. See
 * `isPlutoSameOriginRequest` in `server/utils/pluto-origin.ts`. The public API (`/api/pluto/v1`)
 * is read-only and is not under this prefix.
 */
export default defineEventHandler((event) => {
  assertPlutoSameOrigin(event)
})
