/**
 * Lists items of one content type. Generic, core-internal route — see the
 * content-model skill for the `/_pluto/` prefix and the capability rule
 * this route follows (no `read` capability check, ever).
 *
 * Query: `limit`, `offset`, `published=1` (published rows only), and the admin
 * list query of `parseAdminListQuery`: `search`, `status`, `filter[<field>]`
 * and `sort` (`field` or `-field`). A value that the type does not allow gives 400.
 */
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
  // `?published=1` (or `true`) narrows to published rows. Ignored for a
  // type with no status workflow, which has no unpublished rows.
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
