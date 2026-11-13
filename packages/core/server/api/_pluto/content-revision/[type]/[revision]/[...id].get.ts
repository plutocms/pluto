export default defineEventHandler(async (event) => {
  const type = requireContentType(getRouterParam(event, 'type') ?? '')
  const revision = getRouterParam(event, 'revision', { decode: true }) ?? ''
  const id = getRouterParam(event, 'id', { decode: true }) ?? ''

  return getContentRevision({ event, type }, id, revision)
})
