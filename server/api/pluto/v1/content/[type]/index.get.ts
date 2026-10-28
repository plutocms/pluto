/**
 * The public API: the published items of one public content type. Anonymous. See the
 * content-model skill ("The public API").
 */
export default defineEventHandler((event) => {
  return listPublicContent(
    event,
    getRouterParam(event, 'type') ?? '',
    getQuery(event)
  )
})
