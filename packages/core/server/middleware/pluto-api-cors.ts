import { defineEventHandler } from 'h3'
import { handlePlutoApiCors } from '../utils/pluto-api-cors'

/**
 * The CORS headers of the public API (`/api/pluto/v1/**`). `runtimeConfig.plutoApi.cors` decides
 * them. A preflight answers 204 here. See `server/utils/pluto-api-cors.ts`.
 */
export default defineEventHandler((event) => {
  if (handlePlutoApiCors(event)) {
    return ''
  }
})
