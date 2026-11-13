export default defineEventHandler(async (event) => {
  const type = requireContentType(getRouterParam(event, 'type') ?? '')
  const id = getRouterParam(event, 'id', { decode: true }) ?? ''
  return restoreTrashItem({ event, type }, id)
})
