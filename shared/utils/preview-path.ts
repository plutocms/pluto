/** The path of the page preview that a block editor shows in an iframe. */
export const PLUTO_PREVIEW_PATH = '/_pluto/preview'

/**
 * True for the preview path and every path below it. The preview runs in an
 * iframe inside the admin, so it must not show the admin bar. An app can use
 * the same check to skip its own shell, such as a header or a footer.
 */
export function isPlutoPreviewPath(path: string): boolean {
  return path === PLUTO_PREVIEW_PATH
    || path === `${PLUTO_PREVIEW_PATH}/`
    || path.startsWith(`${PLUTO_PREVIEW_PATH}/`)
}
