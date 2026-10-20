import { defineEventHandler, getQuery, getRouterParam } from 'h3'
import { listPublicItems, setPublicCacheHeaders } from '../../../utils/public-content'

/** `GET /api/_pluto/cms/:type`. The published items of one type. Anonymous. See the github-cms skill. */
export default defineEventHandler(async (event) => {
  const result = await listPublicItems(event, getRouterParam(event, 'type') ?? '', getQuery(event))
  setPublicCacheHeaders(event)
  return result
})
