import { renderMarkdown } from '../markdown/render'

/**
 * The body of a post as sanitized HTML, for the preview of the post editor. It is the same
 * render as the public API (`renderMarkdown`).
 *
 * App code gets this function from the auto-imports. Do not import `shared/markdown/render`
 * with a relative path from app code: the server build of the root project keeps `shared/` as
 * external, and a relative external path does not resolve from the output chunk.
 */
export function plutoPostPreviewHtml(markdown: string): string {
  return renderMarkdown(markdown)
}
