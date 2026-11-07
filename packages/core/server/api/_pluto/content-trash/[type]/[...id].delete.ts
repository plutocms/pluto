/**
 * Deletes a trashed item forever: `DELETE /api/_pluto/content-trash/<type>/<id>`. The references
 * to it go too. Needs the delete capability.
 */
export default defineEventHandler(async (event) => {
  const type = requireContentType(getRouterParam(event, 'type') ?? '')
  const id = getRouterParam(event, 'id', { decode: true }) ?? ''
  await purgeTrashItem({ event, type }, id)
  return { success: true }
})
