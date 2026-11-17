export default defineEventHandler(async (event) => {
  const handle = getRouterParam(event, 'handle') ?? ''
  const length = Number(getRequestHeader(event, 'content-length') ?? 0)
  if (length > PLUTO_FORM_MAX_BODY_BYTES) {
    throw createPlutoError({
      statusCode: 413,
      message: 'The request is too large.',
      key: 'forms.errors.tooLarge',
    })
  }
  const body = await readRawBody(event, 'utf8')

  const answer = await submitPlutoForm(createFormsSubmitDeps(), {
    handle,
    ip: getRequestIP(event, { xForwardedFor: true }) ?? 'unknown',
    body: body ?? '',
  })

  setResponseStatus(event, answer.status)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  for (const [name, value] of Object.entries(answer.headers ?? {})) {
    setResponseHeader(event, name, value)
  }
  return answer.body
})
