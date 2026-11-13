export default defineEventHandler((event) => {
  return getPublicSurround(
    event,
    getRouterParam(event, 'type') ?? '',
    getRouterParam(event, 'id', { decode: true }) ?? '',
    getQuery(event)
  )
})
