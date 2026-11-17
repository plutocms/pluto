export default defineEventHandler(async (event) => {
  await requireFormsCapability(event, PLUTO_FORMS_READ_SUBMISSIONS)
  const handle = requireFormHandle(event)
  await requireFormStore().delete(handle, getRouterParam(event, 'id') ?? '')
  return { ok: true }
})
