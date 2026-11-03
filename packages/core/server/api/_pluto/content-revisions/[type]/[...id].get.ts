/**
 * The saved versions of one item, newest first:
 * `GET /api/_pluto/content-revisions/<type>/<id>?limit=20&cursor=...`. A separate base path, not
 * `/api/_pluto/content/<type>/<id>/revisions`: an id can hold slashes (a nested type). See the
 * content-model skill ("Revisions").
 */
export default defineEventHandler(async (event) => {
  const type = requireContentType(getRouterParam(event, 'type') ?? '')
  const id = getRouterParam(event, 'id', { decode: true }) ?? ''
  const query = getQuery(event)
  const limit = Number.parseInt(String(query.limit ?? ''), 10)

  return listContentRevisions({ event, type }, id, {
    ...(Number.isFinite(limit) && { limit }),
    ...(typeof query.cursor === 'string' &&
      query.cursor && { cursor: query.cursor }),
  })
})
