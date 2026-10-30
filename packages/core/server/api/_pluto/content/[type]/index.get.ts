/**
 * Lists items of one content type. Generic, core-internal route — see the
 * content-model skill for the `/_pluto/` prefix and the capability rule
 * this route follows (no `read` capability check, ever).
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
  const search = query.search === undefined ? undefined : String(query.search)
  // `?published=1` (or `true`) narrows to published rows. Ignored for a
  // type with no status workflow, which has no unpublished rows.
  const published = type.status
    ? query.published === '1' || query.published === 'true'
    : undefined

  return listContentItems({ event, type }, { limit, offset, search, published })
})
