export default defineEventHandler((event) => {
  return listPublicContent(
    event,
    getRouterParam(event, 'type') ?? '',
    getQuery(event)
  )
})
