/** One part of a text: plain text, or code (the text between two backticks). */
export interface PlutoCodeTextPart {
  code: boolean
  text: string
}

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
