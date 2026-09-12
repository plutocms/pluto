/**
 * Updates one item of one content type. Generic, core-internal route — see
 * the content-model skill for the `/_pluto/` prefix, partial-payload
 * validation, and the write-capability enforcement this route follows.
 */
export default defineEventHandler(async (event) => {
  const typeName = getRouterParam(event, 'type')
  const type = requireContentType(typeName ?? '')

  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody(event)

  return updateContentItem({ event, type }, id, body)
})
