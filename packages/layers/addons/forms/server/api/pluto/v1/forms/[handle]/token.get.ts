export default defineEventHandler((event) => {
  const handle = getRouterParam(event, 'handle') ?? ''
  const config = getFormsConfig()
  if (!PLUTO_FORM_HANDLE.test(handle)) {
    throw createPlutoError({
      statusCode: 404,
      message: 'This form does not exist.',
      key: 'forms.errors.notFound',
    })
  }
  if (!config.secret) {
    throw createPlutoError({
      statusCode: 503,
      message: 'The site has no signing secret for forms.',
      key: 'forms.errors.noSecret',
    })
  }
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    token: signFormsToken(config.secret, handle),
    turnstileSiteKey:
      config.turnstileSecret && config.turnstileSiteKey
        ? config.turnstileSiteKey
        : null,
  }
})
