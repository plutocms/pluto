export default defineEventHandler(async (event) => {
  await requireFormsCapability(event, PLUTO_FORMS_READ_SUBMISSIONS)
  const forms = await listFormSummaries()
  return {
    forms: forms.map(({ handle, title, source }) => ({
      handle,
      title,
      source,
    })),
  }
})
