export default defineEventHandler(async (event) => {
  const type = requireContentType(getRouterParam(event, 'type') ?? '')
  return emptyTrash({ event, type })
})
