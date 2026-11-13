export default defineEventHandler((event) => {
  const { drafts } = getQuery(event)
  return getPublicContent(
    event,
    getRouterParam(event, 'type') ?? '',
    getRouterParam(event, 'id', { decode: true }) ?? '',
    { drafts: drafts === '1' || drafts === 'true' }
  )
})
