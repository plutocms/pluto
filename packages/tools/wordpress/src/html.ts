import TurndownService from 'turndown'

interface ListParent {
  nodeName: string
  children: ArrayLike<unknown>
  getAttribute: (name: string) => string | null
}

const service = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
  strongDelimiter: '**',
  hr: '---',
})

service.addRule('listItem', {
  filter: 'li',
  replacement(content, node, options) {
    const text = content
      .replace(/^\n+/, '')
      .replace(/\n+$/, '\n')
      .replace(/\n/g, '\n  ')
    const parent = node.parentNode as unknown as ListParent
    let prefix = `${options.bulletListMarker} `

    if (parent.nodeName === 'OL') {
      const start = parent.getAttribute('start')
      const index = Array.prototype.indexOf.call(parent.children, node)

      prefix = `${start ? Number(start) + index : index + 1}. `
    }

    return prefix + text + (node.nextSibling && !/\n$/.test(text) ? '\n' : '')
  },
})

service.remove(['script', 'style'])

service.keep(['table', 'iframe', 'video', 'audio', 'svg'])

function clean(html: string): string {
  return html
    .replace(/[\u200B\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\r\n?/g, '\n')
}

export const KEPT_HTML = /<(?:table|iframe|video|audio|svg)\b/i

export interface MarkdownResult {
  markdown: string
  keptHtml: boolean
  images: string[]
  shortcodes: string[]
}

const SHORTCODE = /\[([a-z][\w-]*)(?:\s[^\]]*)?\](?!\()/gi

/** The shortcodes in a text, such as `[contact-form-7 id="1"]`. */
export function findShortcodes(source: string): string[] {
  return [...source.matchAll(SHORTCODE)]
    .map((match) => match[0])
    .filter((code) => !/^\[(?:x|\s)\]$/.test(code))
}

/** Rich HTML to Markdown. A table or an embed has no Markdown form, so it stays as HTML. */
export function htmlToMarkdown(html: string): MarkdownResult {
  const source = clean(html)
  const markdown = service
    .turndown(source)
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return {
    markdown,
    keptHtml: KEPT_HTML.test(markdown),
    images: [...source.matchAll(/<img\b[^>]*?\ssrc=["']([^"']+)["']/gi)].map(
      (match) => match[1]!
    ),
    shortcodes: findShortcodes(source),
  }
}

/** HTML to one line of inline Markdown (`**bold**`, `_italic_`, links). */
export function htmlToInline(html: string): string {
  const source = clean(html).replace(/<br\s*\/?>/gi, ' ')

  return service.turndown(`<span>${source}</span>`).replace(/\s+/g, ' ').trim()
}

/** Plain text, with the characters that Markdown reads escaped. */
export function escapeInline(value: string): string {
  return service.escape(value.replace(/\s+/g, ' ').trim())
}

/** Plain text from HTML: the tags go, and the end of a block becomes a space. */
export function stripTags(html: string): string {
  return clean(html)
    .replace(/<\/(?:p|div|li|h[1-6])>|<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
