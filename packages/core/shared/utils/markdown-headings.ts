/** A heading of a Markdown text, for the outline of the post editor. */
export interface PlutoMarkdownHeading {
  /** 1 to 6. */
  level: number
  /** The heading text without the inline Markdown (emphasis, code marks, link targets). */
  text: string
  /** The line of the heading in the text, from 0. */
  line: number
}

const FENCE = /^\s{0,3}(`{3,}|~{3,})/
const ATX = /^ {0,3}(#{1,6})(?=[ \t]|$)/
const SETEXT = /^ {0,3}(?:=+|-+)[ \t]*$/
const LINK = /!?\[([^\]]*)\]\([^)]*\)/g
const MARKS = /[*_~`]/g

function plainText(text: string): string {
  return text.replace(LINK, '$1').replace(MARKS, '').trim()
}

function atxHeading(line: string): { level: number; text: string } | null {
  const open = line.match(ATX)
  if (!open) {
    return null
  }
  let text = line.slice(open[0].length).trim()
  const closing = text.replace(/#+$/, '')
  if (closing === '' || closing.endsWith(' ') || closing.endsWith('\t')) {
    text = closing.trim()
  }
  return { level: open[1]!.length, text }
}

export function plutoMarkdownHeadings(
  markdown: string
): PlutoMarkdownHeading[] {
  const lines = markdown.split(/\r?\n/)
  const headings: PlutoMarkdownHeading[] = []
  let fence: string | null = null

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!
    const marker = line.match(FENCE)?.[1]
    if (marker) {
      if (fence === null) {
        fence = marker[0]!
      } else if (marker[0] === fence) {
        fence = null
      }
      continue
    }
    if (fence !== null) {
      continue
    }

    const atx = atxHeading(line)
    if (atx) {
      const text = plainText(atx.text)
      if (text) {
        headings.push({ level: atx.level, text, line: index })
      }
      continue
    }

    const next = lines[index + 1]
    if (next !== undefined && SETEXT.test(next) && line.trim() !== '') {
      headings.push({
        level: next.trim().startsWith('=') ? 1 : 2,
        text: plainText(line),
        line: index,
      })
      index++
    }
  }
  return headings
}
