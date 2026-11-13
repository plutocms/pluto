export default defineEventHandler(async (event) => {
  const typeName = getRouterParam(event, 'type')
  const type = requireContentType(typeName ?? '')

  const idOrSlug = getRouterParam(event, 'id', { decode: true }) ?? ''

  return getContentItem({ event, type }, idOrSlug)
})
