export default defineEventHandler(async (event) => {
  const typeName = getRouterParam(event, 'type')
  const type = requireContentType(typeName ?? '')

  const query = getQuery(event)
  const weeks =
    query.weeks === undefined ? 12 : Number.parseInt(String(query.weeks), 10)

  return contentActivity(
    { event, type },
    { weeks: Number.isNaN(weeks) ? 12 : weeks }
  )
})
