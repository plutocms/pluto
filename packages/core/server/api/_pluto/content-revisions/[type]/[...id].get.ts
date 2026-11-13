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
