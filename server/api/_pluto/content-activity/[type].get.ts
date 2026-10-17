/**
 * Weekly creation counts for one content type, for the dashboard activity
 * chart: `GET /api/_pluto/content-activity/<type>?weeks=12`. A separate path,
 * not `/api/_pluto/content/<type>/activity`, so it never collides with the
 * `[id]` item route for an item whose id or slug is "activity".
 */
export default defineEventHandler(async (event) => {
  const typeName = getRouterParam(event, 'type')
  const type = requireContentType(typeName ?? '')

  const query = getQuery(event)
  const weeks = query.weeks === undefined ? 12 : Number.parseInt(String(query.weeks), 10)

  return contentActivity({ event, type }, { weeks: Number.isNaN(weeks) ? 12 : weeks })
})
