export default defineEventHandler(async (event) => {
  if (!isFormsAdminPath(getRequestURL(event).pathname)) {
    return
  }
  await requireFormsCapability(event, PLUTO_FORMS_WRITE)
})
