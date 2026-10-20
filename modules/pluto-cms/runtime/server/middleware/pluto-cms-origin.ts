import { defineEventHandler } from 'h3'
import { assertSameOrigin } from '../utils/origin'

/**
 * Server middleware. It blocks a cross-site request that would change state
 * on `/api/_pluto/**`. See `isSameOriginRequest`.
 */
export default defineEventHandler((event) => {
  assertSameOrigin(event)
})
