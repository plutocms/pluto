/** One part of a text: plain text, or code (the text between two backticks). */
export interface PlutoCodeTextPart {
  code: boolean
  text: string
}

/**
 * Splits a text at its backticks: "Set `NAME` in `.env`" gives a text part, a code part, a text
 * part and a code part. A backtick with no closing one stays as text. An empty pair gives nothing.
 * `PlutoCodeText` renders the code parts as `<code>`, so a translated string can mark a name, a
 * path or a command with no HTML.
 */
export function plutoCodeTextParts(text: string): PlutoCodeTextPart[] {
  const parts: PlutoCodeTextPart[] = []
  const pattern = /`([^`]*)`/g
  let last = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > last) {
      parts.push({ code: false, text: text.slice(last, index) })
    }
    if (match[1]) {
      parts.push({ code: true, text: match[1] })
    }
    last = index + match[0].length
  }
  if (last < text.length) {
    parts.push({ code: false, text: text.slice(last) })
  }
  return parts
}

/** The text with no backticks, for a place that shows plain text (a title, a toast, a label). */
export function plutoPlainCodeText(text: string): string {
  return plutoCodeTextParts(text)
    .map((part) => part.text)
    .join('')
}
