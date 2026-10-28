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

const FENCE = /^\s*(`{3,}|~{3,})/
const BLOCK_OPEN = /^\s*:{2,}[a-z][\w-]*(?:\{[^}]*\})?\s*$/i
const BLOCK_CLOSE = /^\s*:{2,}\s*$/
const SLOT = /^\s*#[a-z][\w-]*\s*$/i
const PROPS_FENCE = /^\s*---\s*$/

/** Inline MDC: components (`:icon{name="x"}`) and attributes (`[text]{.class}`, `[a](/b){target=_blank}`). */
function stripInlineMdc(line: string): string {
  return line
    .replace(/(^|[\s(]):[a-z][\w-]*\{[^}]*\}/gi, '$1')
    .replace(/(\]\([^)]*\))\{[^}]*\}/g, '$1')
    .replace(/\[([^\]]*)\]\{[^}]*\}/g, '$1')
}

/**
 * Removes the MDC syntax of Nuxt Content from Markdown and keeps the text in it, so a page that
 * uses components renders as plain Markdown: the `::name` and `::` lines of a block component go,
 * with the YAML props block (`---` … `---`) right after an open line, the `#slot` lines inside a
 * component, inline components, and `{…}` attributes. Code in a fence does not change.
 */
export function stripMdc(markdown: string): string {
  const lines = markdown.split(/\r?\n/)
  const out: string[] = []
  let fence: string | undefined
  let depth = 0
  let inProps = false
  let afterOpen = false

  for (const line of lines) {
    const fenceMatch = FENCE.exec(line)
    if (fence) {
      out.push(line)
      if (
        fenceMatch &&
        fenceMatch[1]!.startsWith(fence[0]!) &&
        fenceMatch[1]!.length >= fence.length
      ) {
        fence = undefined
      }
      continue
    }
    if (inProps) {
      inProps = !PROPS_FENCE.test(line)
      continue
    }
    if (afterOpen && PROPS_FENCE.test(line)) {
      inProps = true
      afterOpen = false
      continue
    }
    afterOpen = false
    if (fenceMatch) {
      fence = fenceMatch[1]
      out.push(line)
      continue
    }
    if (BLOCK_OPEN.test(line)) {
      depth++
      afterOpen = true
      out.push('')
      continue
    }
    if (BLOCK_CLOSE.test(line)) {
      depth = Math.max(0, depth - 1)
      out.push('')
      continue
    }
    if (depth > 0 && SLOT.test(line)) {
      out.push('')
      continue
    }
    out.push(stripInlineMdc(line))
  }
  return out.join('\n')
}

/**
 * Renders Markdown to HTML, then sanitizes it. The result is safe for `innerHTML`. MDC syntax goes
 * first (`stripMdc`), so a Nuxt Content page shows its text, not its component markers.
 */
export function renderMarkdown(markdown: string): string {
  if (typeof markdown !== 'string' || markdown.trim() === '') {
    return ''
  }
  return sanitizeHtml(marked.parse(stripMdc(markdown), { async: false }))
}

const NAMED_TEXT_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

function decodeEntities(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, body: string) => {
      if (body[0] === '#') {
        const isHex = body[1] === 'x' || body[1] === 'X'
        const codePoint = Number.parseInt(
          isHex ? body.slice(2) : body.slice(1),
          isHex ? 16 : 10
        )
        return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint)
      }
      return NAMED_TEXT_ENTITIES[body] ?? match
    }
  )
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
