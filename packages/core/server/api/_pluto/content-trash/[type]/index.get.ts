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
