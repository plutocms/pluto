export default defineEventHandler(async (event) => {
  await requireFormsCapability(event, PLUTO_FORMS_READ_SUBMISSIONS)
  const handle = requireFormHandle(event)
  const store = requireFormStore()
  const query = getQuery(event)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20))
  const offset = Math.max(0, Number(query.offset) || 0)
  return store.list(handle, { limit, offset })
})
