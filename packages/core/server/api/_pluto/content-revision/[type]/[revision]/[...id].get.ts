/**
 * One item as it was at a revision: `GET /api/_pluto/content-revision/<type>/<revision>/<id>`. The
 * revision comes before the id, because the id takes the rest of the path (a nested type).
 */
export default defineEventHandler(async (event) => {
  const type = requireContentType(getRouterParam(event, 'type') ?? '')
  const revision = getRouterParam(event, 'revision', { decode: true }) ?? ''
  const id = getRouterParam(event, 'id', { decode: true }) ?? ''

  return getContentRevision({ event, type }, id, revision)
})
