export default defineEventHandler(async (event) => {
  const type = requireContentType(getRouterParam(event, 'type') ?? '')
  const id = getRouterParam(event, 'id', { decode: true }) ?? ''
  await purgeTrashItem({ event, type }, id)
  return { success: true }
})
