import { renderMarkdown } from '../markdown/render'

export function plutoPostPreviewHtml(markdown: string): string {
  return renderMarkdown(markdown)
}
