/**
 * Colors the code blocks of the HTML of the post preview with the code highlighters of the site, so
 * the preview shows the code as the site does (pluto-highlight.ts). Needs the write capability of
 * the type, like a save. `highlighted: false`: the site has no highlighter, and the preview stops
 * asking.
 */
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
