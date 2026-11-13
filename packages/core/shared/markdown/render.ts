// This file runs on the server and in the browser: it imports no Node or Nuxt API.
import type { Tokens } from 'marked'
import { Marked } from 'marked'
import { ELEMENT_NODE, parse, TEXT_NODE, walkSync } from 'ultrahtml'
import {
  componentMarkerHtml,
  componentStart,
  matchEmptyComponent,
} from './component'
import {
  hasBlankTarget,
  matchBlankLink,
  PLUTO_LINK_BLANK,
  PLUTO_LINK_BLANK_REL,
} from './link-target'
import { sanitizeHtml } from './sanitize-html'

const PLUTO_EMBED_ATTRIBUTE = 'data-pluto-embed'

export function isEmbedParagraph(tokens: Tokens.Generic[]): boolean {
  const parts = tokens.filter(
    (token) => !(token.type === 'text' && !String(token.raw).trim())
  )
  if (parts.length !== 1 || parts[0]!.type !== 'link') {
    return false
  }
  const link = parts[0] as Tokens.Link
  return /^https?:\/\//i.test(link.href) && link.text.trim() === link.href
}

// The `html` renderer returns an empty string, so raw HTML in a post never reaches the output.
// The sanitizer still runs on the result, as a second guard.
const marked = new Marked({
  gfm: true,
  extensions: [plutoComponentExtension(), plutoBlankLinkExtension()],
  renderer: {
    html: () => '',
    paragraph(token) {
      if (!isEmbedParagraph(token.tokens)) {
        return false
      }
      return `<p ${PLUTO_EMBED_ATTRIBUTE}="">${this.parser.parseInline(token.tokens)}</p>\n`
    },
  },
})

export function plutoComponentExtension() {
  return {
    name: 'plutoComponent',
    level: 'block' as const,
    start: (src: string) => {
      const index = componentStart(src)
      return index < 0 ? undefined : index
    },
    tokenizer(src: string) {
      const match = matchEmptyComponent(src)
      return match
        ? {
            type: 'plutoComponent',
            raw: match.raw,
            name: match.name,
            props: match.props,
          }
        : undefined
    },
    renderer(token: Tokens.Generic) {
      return componentMarkerHtml(
        String(token.name),
        (token.props ?? {}) as Record<string, unknown>
      )
    },
  }
}

export function plutoBlankLinkExtension() {
  return {
    name: 'plutoBlankLink',
    level: 'inline' as const,
    start: (src: string) => {
      const index = src.indexOf('[')
      return index < 0 ? undefined : index
    },
    tokenizer(
      this: { lexer: { inlineTokens: (src: string) => Tokens.Generic[] } },
      src: string
    ) {
      const match = matchBlankLink(src)
      if (!match) {
        return undefined
      }
      const tokens = this.lexer.inlineTokens(match.link)
      if (tokens.length !== 1 || tokens[0]!.type !== 'link') {
        return undefined
      }
      return { type: 'plutoBlankLink', raw: match.raw, tokens }
    },
    renderer(
      this: { parser: { parseInline: (tokens: Tokens.Generic[]) => string } },
      token: Tokens.Generic
    ) {
      return this.parser
        .parseInline(token.tokens ?? [])
        .replace(/^<a /, `<a target="_blank" rel="${PLUTO_LINK_BLANK_REL}" `)
    },
  }
}

const FENCE = /^\s*(`{3,}|~{3,})/
const BLOCK_OPEN = /^\s*:{2,}[a-z][\w-]*(?:\{[^}]*\})?\s*$/i
const BLOCK_CLOSE = /^\s*:{2,}\s*$/
const SLOT = /^\s*#[a-z][\w-]*\s*$/i
const PROPS_FENCE = /^\s*---\s*$/

function stripInlineMdc(line: string): string {
  return line
    .replace(/(^|[\s(]):[a-z][\w-]*\{[^}]*\}/gi, '$1')
    .replace(
      /(\]\([^)]*\))\{([^}]*)\}/g,
      (_match, link: string, attributes: string) =>
        hasBlankTarget(attributes) ? link + PLUTO_LINK_BLANK : link
    )
    .replace(/\[([^\]]*)\]\{[^}]*\}/g, '$1')
}

function emptyComponentEnd(lines: string[], index: number): number | undefined {
  let end = index + 1
  while (end < lines.length && !lines[end]!.trim()) {
    end++
  }
  if (end >= lines.length) {
    return undefined
  }
  const text = `${lines.slice(index, end + 1).join('\n')}\n`
  return matchEmptyComponent(text)?.raw.length === text.length ? end : undefined
}

/**
 * Removes the MDC syntax of Nuxt Content from Markdown and keeps the text in it. Code in a fence
 * does not change. An empty component at the top level (`::name{props}` then `::`) stays: it is a
 * content component.
 */
export function stripMdc(markdown: string): string {
  const lines = markdown.split(/\r?\n/)
  const out: string[] = []
  let fence: string | undefined
  let depth = 0
  let inProps = false
  let afterOpen = false

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!
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
    if (depth === 0 && BLOCK_OPEN.test(line)) {
      const empty = emptyComponentEnd(lines, index)
      if (empty !== undefined) {
        out.push(line, ...lines.slice(index + 1, empty + 1))
        index = empty
        continue
      }
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
