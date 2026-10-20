import { defineEventHandler, getRouterParam } from 'h3'
import { getPublicItem, setPublicCacheHeaders } from '../../../utils/public-content'

/** `GET /api/_pluto/cms/:type/:slug`. One published item with `html`. Anonymous. See the github-cms skill. */
export default defineEventHandler(async (event) => {
  const item = await getPublicItem(event, getRouterParam(event, 'type') ?? '', getRouterParam(event, 'slug') ?? '')
  setPublicCacheHeaders(event)
  return item
})
