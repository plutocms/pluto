/**
 * Gets one item of one content type, by id or slug. Generic, core-internal
 * route — see the content-model skill for the `/_pluto/` prefix and the
 * capability rule this route follows (no `read` capability check, ever).
 */
export default defineEventHandler(async (event) => {
  const typeName = getRouterParam(event, 'type')
  const type = requireContentType(typeName ?? '')

  const idOrSlug = getRouterParam(event, 'id') ?? ''

  return getContentItem({ event, type }, idOrSlug)
})
