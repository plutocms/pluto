/**
 * The public API: the published items before and after one item, in the order of `sort`
 * (`previous`, `next`). Anonymous. See `getPublicSurround`.
 */
export default defineEventHandler((event) => {
  return getPublicSurround(
    event,
    getRouterParam(event, 'type') ?? '',
    getRouterParam(event, 'id', { decode: true }) ?? '',
    getQuery(event)
  )
})
