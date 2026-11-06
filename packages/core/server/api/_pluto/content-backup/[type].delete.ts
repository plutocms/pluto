/**
 * Removes the server copy of the unsaved changes of the caller:
 * `DELETE /api/_pluto/content-backup/<type>?id=<id>`. See the content-backup skill.
 */
export default defineEventHandler(async (event) => {
  const type = requireContentType(getRouterParam(event, 'type') ?? '')
  const id = getQuery(event).id

  return removeContentBackup(
    { event, type },
    typeof id === 'string' && id ? id : undefined
  )
})
