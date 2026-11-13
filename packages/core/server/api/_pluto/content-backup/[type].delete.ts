export default defineEventHandler(async (event) => {
  const type = requireContentType(getRouterParam(event, 'type') ?? '')
  const id = getQuery(event).id

  return removeContentBackup(
    { event, type },
    typeof id === 'string' && id ? id : undefined
  )
})
