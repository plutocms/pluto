/**
 * The trash of one content type, the last trashed first:
 * `GET /api/_pluto/content-trash/<type>?limit=50&offset=0&search=...`. It purges the items older
 * than 30 days first. Needs the delete capability. See the content-model skill ("Trash").
 */
export default defineEventHandler(async (event) => {
  const type = requireContentType(getRouterParam(event, 'type') ?? '')
  const query = getQuery(event)
  const limit = Number.parseInt(String(query.limit ?? ''), 10)
  const offset = Number.parseInt(String(query.offset ?? ''), 10)
  const search =
    typeof query.search === 'string'
      ? query.search.trim().slice(0, ADMIN_LIST_SEARCH_MAX)
      : ''

  return listTrashItems(
    { event, type },
    {
      ...(Number.isFinite(limit) && limit > 0 && { limit }),
      ...(Number.isFinite(offset) && offset > 0 && { offset }),
      ...(search && { search }),
    }
  )
})
