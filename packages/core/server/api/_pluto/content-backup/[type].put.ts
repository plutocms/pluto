/**
 * Replaces the server copy of the unsaved changes of the caller:
 * `PUT /api/_pluto/content-backup/<type>?id=<id>`. The body is the raw text of the record. A
 * `keepalive` request from `pagehide` sends it too. See the content-backup skill.
 */
export default defineEventHandler(async (event) => {
  const type = requireContentType(getRouterParam(event, 'type') ?? '')
  const id = getQuery(event).id
  const body = await readRawBody(event, 'utf8')

  return putContentBackup(
    { event, type },
    typeof id === 'string' && id ? id : undefined,
    body
  )
})
