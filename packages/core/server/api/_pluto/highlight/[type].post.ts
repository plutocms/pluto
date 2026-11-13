const MAX_HTML_LENGTH = 1_000_000

export default defineEventHandler(async (event) => {
  const type = requireContentType(getRouterParam(event, 'type') ?? '')
  await authorizeContentOperation(event, type.capabilities?.write)

  const body = await readBody<{ html?: unknown }>(event)
  const html = typeof body?.html === 'string' ? body.html : ''
  if (html.length > MAX_HTML_LENGTH) {
    throw createPlutoError({
      statusCode: 413,
      message: 'The post is too long to preview with the colors of its code.',
      key: 'pluto.errors.previewTooLarge',
    })
  }
  if (listPlutoHighlighters().length === 0) {
    return { html, highlighted: false }
  }
  return {
    html: await highlightPlutoHtml(html, getPlutoApiConfig().highlighter),
    highlighted: true,
  }
})
