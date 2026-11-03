/**
 * The public API: one published item of a public content type, by id or slug. Anonymous, except
 * `?drafts=1` for an editor (see `getPublicContent`). The id can hold slashes (a nested type), so
 * the route takes the rest of the path.
 */
export default defineEventHandler((event) => {
  const { drafts } = getQuery(event)
  return getPublicContent(
    event,
    getRouterParam(event, 'type') ?? '',
    getRouterParam(event, 'id', { decode: true }) ?? '',
    { drafts: drafts === '1' || drafts === 'true' }
  )
})
