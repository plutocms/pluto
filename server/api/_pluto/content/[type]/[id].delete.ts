/**
 * Deletes one item of one content type. Generic, core-internal route — see
 * the content-model skill for the `/_pluto/` prefix and the
 * delete-capability enforcement this route follows.
 */
export default defineEventHandler(async (event) => {
  const typeName = getRouterParam(event, 'type')
  const type = requireContentType(typeName ?? '')

  const id = getRouterParam(event, 'id') ?? ''

  await deleteContentItem({ event, type }, id)

  return { success: true }
})
