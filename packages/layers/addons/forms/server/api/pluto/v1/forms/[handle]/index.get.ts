export default defineEventHandler(async (event) => {
  const handle = getRouterParam(event, 'handle') ?? ''
  const form = await loadFormDefinition(handle)
  if (!form) {
    throw createPlutoError({
      statusCode: 404,
      message: 'This form does not exist.',
      key: 'forms.errors.notFound',
    })
  }
  setPublicApiCache(event)
  return plutoPublicForm(form)
})
