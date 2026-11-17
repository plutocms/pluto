export default defineEventHandler(async (event) => {
  await requireFormsCapability(event, PLUTO_FORMS_READ_SUBMISSIONS)
  const handle = requireFormHandle(event)
  const submission = await requireFormStore().get(
    handle,
    getRouterParam(event, 'id') ?? ''
  )
  if (!submission) {
    throw createPlutoError({
      statusCode: 404,
      message: 'Not found.',
      key: 'pluto.errors.notFound',
    })
  }
  return submission
})
