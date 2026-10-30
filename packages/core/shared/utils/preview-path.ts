/** The path of the page preview that a block editor shows in an iframe. */
export const PLUTO_PREVIEW_PATH = '/_pluto/preview'

/**
 * The path of the post preview that the post editor (`post-canvas`) shows in an iframe. It is not
 * below `PLUTO_PREVIEW_PATH`: the nuxt-content layer has a page there, and a page below it would
 * be a child route of that page.
 */
export const PLUTO_POST_PREVIEW_PATH = '/_pluto/post-preview'

function isPathOrBelow(path: string, base: string): boolean {
  return path === base || path === `${base}/` || path.startsWith(`${base}/`)
}

/**
 * True for the preview paths (the page preview and the post preview) and every path below them.
 * A preview runs in an iframe inside the admin, so it must not show the admin bar. An app can use
 * the same check to skip its own shell, such as a header or a footer.
 */
export function isPlutoPreviewPath(path: string): boolean {
  return (
    isPathOrBelow(path, PLUTO_PREVIEW_PATH) ||
    isPathOrBelow(path, PLUTO_POST_PREVIEW_PATH)
  )
}
