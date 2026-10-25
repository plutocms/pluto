/**
 * Gets one item of one content type, by id or slug. Generic, core-internal
 * route — see the content-model skill for the `/_pluto/` prefix and the
 * capability rule this route follows (no `read` capability check, ever).
 */
// The id can hold slashes (a nested content type), so the route takes the
// whole rest of the path as `id`.
export default defineEventHandler(async (event) => {
  const typeName = getRouterParam(event, 'type')
  const type = requireContentType(typeName ?? '')

  const idOrSlug = getRouterParam(event, 'id', { decode: true }) ?? ''

  return getContentItem({ event, type }, idOrSlug)
})
