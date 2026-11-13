export default defineEventHandler(async (event) => {
  const type = requireContentType(getRouterParam(event, 'type') ?? '')
  const id = getQuery(event).id
  const body = await readRawBody(event, 'utf8')

  return putContentBackup(
    { event, type },
    typeof id === 'string' && id ? id : undefined,
    body
  )
})
