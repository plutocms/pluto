export default defineEventHandler(async (event) => {
  const typeName = getRouterParam(event, 'type')
  const type = requireContentType(typeName ?? '')

  const id = getRouterParam(event, 'id', { decode: true }) ?? ''
  const body = await readBody(event)

  return updateContentItem({ event, type }, id, body)
})
