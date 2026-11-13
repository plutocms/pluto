export default defineEventHandler(async (event) => {
  const typeName = getRouterParam(event, 'type')
  const type = requireContentType(typeName ?? '')

  const query = getQuery(event)
  const limit =
    query.limit === undefined
      ? undefined
      : Number.parseInt(query.limit as string, 10)
  const offset =
    query.offset === undefined
      ? undefined
      : Number.parseInt(query.offset as string, 10)
  const published = type.status
    ? query.published === '1' || query.published === 'true'
    : undefined

  const { query: list, invalid } = parseAdminListQuery(type, query)
  const name = invalid[0]
  if (name !== undefined) {
    throw createPlutoError({
      statusCode: 400,
      message: `The query parameter "${name}" is not valid.`,
      key: 'pluto.errors.invalidQuery',
      params: { name },
    })
  }

  return listContentItems(
    { event, type },
    { limit, offset, published, ...list }
  )
})
