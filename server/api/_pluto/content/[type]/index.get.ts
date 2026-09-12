/**
 * Lists items of one content type. Generic, core-internal route — see the
 * content-model skill for the `/_pluto/` prefix and the capability rule
 * this route follows (no `read` capability check, ever).
 */
export default defineEventHandler(async (event) => {
  const typeName = getRouterParam(event, 'type')
  const type = requireContentType(typeName ?? '')

  const query = getQuery(event)
  const limit = query.limit === undefined ? undefined : Number.parseInt(query.limit as string, 10)
  const offset = query.offset === undefined ? undefined : Number.parseInt(query.offset as string, 10)
  const search = query.search === undefined ? undefined : String(query.search)

  return listContentItems({ event, type }, { limit, offset, search })
})
