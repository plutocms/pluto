import { Marked } from 'marked'
import { ELEMENT_NODE, parse, TEXT_NODE, walkSync } from 'ultrahtml'
import { sanitizeHtml } from './sanitize-html'

// One `Marked` instance for every render. GFM gives tables, task lists,
// strikethrough and autolinks. The `html` renderer returns an empty string,
// so raw HTML in a post never reaches the output. The sanitizer still runs
// on the result, as a second guard.
const marked = new Marked({
  gfm: true,
  renderer: {
    html: () => '',
  },
})

/** Renders Markdown to HTML, then sanitizes it. The result is safe for `innerHTML`. */
export function renderMarkdown(markdown: string): string {
  if (typeof markdown !== 'string' || markdown.trim() === '') {
    return ''
  }
  return sanitizeHtml(marked.parse(markdown, { async: false }))
}

const NAMED_TEXT_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: '\'',
  nbsp: ' ',
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X'
      const codePoint = Number.parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10)
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint)
    }
    return NAMED_TEXT_ENTITIES[body] ?? match
  })
}

/**
 * Turns Markdown into plain text for an excerpt. A block gets a space around
 * it. Entities are decoded and white space collapses. A text longer than
 * `maxLength` is cut at a word edge and ends with an ellipsis. The result is
 * never longer than `maxLength`.
 */
export function markdownToPlainText(markdown: string, maxLength = 200): string {
  const html = renderMarkdown(markdown)
  if (!html) {
    return ''
  }

  const parts: string[] = []
  walkSync(parse(html), (node) => {
    if (node.type === TEXT_NODE) {
      parts.push(decodeEntities(node.value))
    } else if (node.type === ELEMENT_NODE) {
      parts.push(' ')
    }
  })
  const text = parts.join('').replace(/\s+/g, ' ').trim()

  if (maxLength <= 0) {
    return ''
  }
  if (text.length <= maxLength) {
    return text
  }
  const cut = text.slice(0, Math.max(0, maxLength - 1))
  const lastSpace = cut.lastIndexOf(' ')
  const trimmed = lastSpace > maxLength / 2 ? cut.slice(0, lastSpace) : cut
  return `${trimmed.trimEnd()}…`
}
