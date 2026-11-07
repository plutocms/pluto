/**
 * Restores a trashed item: `POST /api/_pluto/content-trash/<type>/<id>`. Answers the item. 409
 * when a live item has the id. Needs the delete capability.
 */
export default defineEventHandler(async (event) => {
  const type = requireContentType(getRouterParam(event, 'type') ?? '')
  const id = getRouterParam(event, 'id', { decode: true }) ?? ''
  return restoreTrashItem({ event, type }, id)
})
