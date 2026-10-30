/**
 * The public API: one published item of a public content type, by id or slug. Anonymous. The id
 * can hold slashes (a nested type), so the route takes the rest of the path.
 */
export default defineEventHandler((event) => {
  return getPublicContent(
    event,
    getRouterParam(event, 'type') ?? '',
    getRouterParam(event, 'id', { decode: true }) ?? ''
  )
})
