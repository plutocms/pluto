/**
 * The server copy of the unsaved changes of the caller:
 * `GET /api/_pluto/content-backup/<type>?id=<id>`. The item id is a query, not a path: an id can
 * hold slashes (a nested type). No `id` means a new item. Answers `supported: false` when the
 * adapter keeps no copies. See the content-backup skill.
 */
export default defineEventHandler(async (event) => {
  const type = requireContentType(getRouterParam(event, 'type') ?? '')
  const id = getQuery(event).id

  return getContentBackup(
    { event, type },
    typeof id === 'string' && id ? id : undefined
  )
})
