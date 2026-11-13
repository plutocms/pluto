export default defineEventHandler(async (event) => {
  const typeName = getRouterParam(event, 'type')
  const type = requireContentType(typeName ?? '')

  const id = getRouterParam(event, 'id', { decode: true }) ?? ''

  await deleteContentItem({ event, type }, id)

  return { success: true }
})
