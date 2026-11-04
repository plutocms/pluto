import { defineEventHandler } from 'h3'
import { buildPublicIndex } from '../../../../../server/utils/pluto-public-api'

/**
 * Route: GET /api/pluto/v1/index.json, in a static build only. The prerender writes it as a file:
 * every published item of every public type. The list composables of the browser answer from it,
 * because a static site has no API. See the git-cms skill ("Static build").
 */
export default defineEventHandler((event) => buildPublicIndex(event))
