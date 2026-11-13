export type PlutoMarkdownFormat =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | 'link'
  | 'heading'
  | 'bullet'
  | 'number'
  | 'quote'
  | 'codeblock'

/** One change of the text, and the selection after it. */
export interface PlutoFormatEdit {
  from: number
  to: number
  insert: string
  selection: { anchor: number; head: number }
}

const INLINE_MARKERS: Partial<Record<PlutoMarkdownFormat, string>> = {
  bold: '**',
  italic: '_',
  strike: '~~',
  code: '`',
}

function wrap(
  text: string,
  from: number,
  to: number,
  marker: string
): PlutoFormatEdit {
  const selected = text.slice(from, to)
  const size = marker.length
  if (
    selected.length >= size * 2 &&
    selected.startsWith(marker) &&
    selected.endsWith(marker)
  ) {
    const inner = selected.slice(size, -size)
    return {
      from,
      to,
      insert: inner,
      selection: { anchor: from, head: from + inner.length },
    }
  }
  if (
    text.slice(from - size, from) === marker &&
    text.slice(to, to + size) === marker
  ) {
    return {
      from: from - size,
      to: to + size,
      insert: selected,
      selection: { anchor: from - size, head: to - size },
    }
  }
  const insert = `${marker}${selected}${marker}`
  return {
    from,
    to,
    insert,
    selection: { anchor: from + size, head: to + size },
  }
}

function link(text: string, from: number, to: number): PlutoFormatEdit {
  const selected = text.slice(from, to)
  if (!selected) {
    return {
      from,
      to,
      insert: '[text](https://)',
      selection: { anchor: from + 1, head: from + 5 },
    }
  }
  const insert = `[${selected}](https://)`
  const url = from + selected.length + 3
  return {
    from,
    to,
    insert,
    selection: { anchor: url, head: url + 'https://'.length },
  }
}

function lineRange(
  text: string,
  from: number,
  to: number
): { start: number; end: number } {
  const start = text.lastIndexOf('\n', from - 1) + 1
  const next = text.indexOf(
    '\n',
    to > from && text[to - 1] === '\n' ? to - 1 : to
  )
  return { start, end: next === -1 ? text.length : next }
}

function editLines(
  text: string,
  from: number,
  to: number,
  change: (lines: string[]) => string[]
): PlutoFormatEdit {
  const { start, end } = lineRange(text, from, to)
  const insert = change(text.slice(start, end).split('\n')).join('\n')
  return {
    from: start,
    to: end,
    insert,
    selection: { anchor: start, head: start + insert.length },
  }
}

const PREFIXES: Partial<Record<PlutoMarkdownFormat, RegExp>> = {
  bullet: /^(\s*)[-*+] /,
  number: /^(\s*)\d+\. /,
  quote: /^> ?/,
}

function prefixLines(
  text: string,
  from: number,
  to: number,
  format: 'bullet' | 'number' | 'quote'
): PlutoFormatEdit {
  const pattern = PREFIXES[format]!
  return editLines(text, from, to, (lines) => {
    const filled = lines.filter((line) => line.trim())
    if (filled.length && filled.every((line) => pattern.test(line))) {
      return lines.map((line) => line.replace(pattern, '$1'))
    }
    let count = 0
    return lines.map((line) => {
      if (!line.trim()) {
        return line
      }
      const bare = line.replace(/^(\s*)(?:[-*+]|\d+\.) /, '$1')
      const indent = /^\s*/.exec(bare)![0]
      const rest = bare.slice(indent.length)
      count++
      if (format === 'quote') {
        return `> ${line}`
      }
      return `${indent}${format === 'bullet' ? '-' : `${count}.`} ${rest}`
    })
  })
}

function heading(text: string, from: number, to: number): PlutoFormatEdit {
  return editLines(text, from, to, (lines) =>
    lines.map((line) => {
      const match = /^(#{1,6}) /.exec(line)
      const body = match ? line.slice(match[0].length) : line
      const level = match?.[1]!.length ?? 0
      if (level === 0 || level === 1) {
        return `## ${body}`
      }
      return level === 2 ? `### ${body}` : body
    })
  )
}

export function headingMarkdown(
  text: string,
  from: number,
  to: number,
  level: number
): PlutoFormatEdit {
  const marks = '#'.repeat(Math.min(Math.max(Math.trunc(level), 0), 6))
  const edit = editLines(text, from, to, (lines) =>
    lines.map((line) => {
      const body = line.replace(/^#{1,6}(?: |$)/, '')
      return marks ? `${marks} ${body}` : body
    })
  )
  if (from === to) {
    const end = edit.from + edit.insert.length
    edit.selection = { anchor: end, head: end }
  }
  return edit
}

function codeBlock(text: string, from: number, to: number): PlutoFormatEdit {
  if (
    from === to &&
    !text.slice(text.lastIndexOf('\n', from - 1) + 1, from).trim()
  ) {
    const insert = '```\n\n```'
    return { from, to, insert, selection: { anchor: from + 4, head: from + 4 } }
  }
  return editLines(text, from, to, (lines) => {
    if (
      lines.length >= 2 &&
      /^\s*(?:```|~~~)/.test(lines[0]!) &&
      /^\s*(?:```|~~~)\s*$/.test(lines.at(-1)!)
    ) {
      return lines.slice(1, -1)
    }
    return ['```', ...lines, '```']
  })
}

export function formatMarkdown(
  text: string,
  from: number,
  to: number,
  format: PlutoMarkdownFormat
): PlutoFormatEdit {
  const marker = INLINE_MARKERS[format]
  if (marker) {
    return wrap(text, from, to, marker)
  }
  switch (format) {
    case 'link':
      return link(text, from, to)
    case 'heading':
      return heading(text, from, to)
    case 'codeblock':
      return codeBlock(text, from, to)
    default:
      return prefixLines(
        text,
        from,
        to,
        format as 'bullet' | 'number' | 'quote'
      )
  }
}

export function minimalChange(
  before: string,
  after: string
): { from: number; to: number; insert: string } {
  let start = 0
  const max = Math.min(before.length, after.length)
  while (start < max && before[start] === after[start]) {
    start++
  }
  let end = 0
  while (
    end < max - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  ) {
    end++
  }
  return {
    from: start,
    to: before.length - end,
    insert: after.slice(start, after.length - end),
  }
}
