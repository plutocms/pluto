export default defineEventHandler(async (event) => {
  const typeName = getRouterParam(event, 'type')
  const type = requireContentType(typeName ?? '')

  const body = await readBody(event)

  return createContentItem({ event, type }, body)
})
