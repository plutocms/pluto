/**
 * Empties the trash of one content type: `DELETE /api/_pluto/content-trash/<type>`. Every trashed
 * item goes forever. Needs the delete capability. Answers `{ purged }`.
 */
export default defineEventHandler(async (event) => {
  const type = requireContentType(getRouterParam(event, 'type') ?? '')
  return emptyTrash({ event, type })
})
