/** The kind of Markdown syntax that the visual editor (CommonMark and strikethrough) cannot keep. */
export type UnsafeMarkdownKind
  = | 'mdc-block'
    | 'mdc-inline'
    | 'attributes'
    | 'html'
    | 'table'
    | 'task-list'
    | 'footnote'
    | 'fence-meta'

export interface UnsafeMarkdownIssue {
  kind: UnsafeMarkdownKind
  /** The first line (1-based) where this kind appears. */
  line: number
}

/** A fence info string that the visual editor keeps: nothing, or one language name. */
const SAFE_FENCE_INFO = /^[\w+#.-]*$/
const MDC_BLOCK = /^\s*::/
const MDC_INLINE = /(?:^|[^\w:/]):[a-z][\w-]*[{[]/i
const HTML_TAG = /<\/?[a-z][\w:-]*(?:\s[^<>]*)?\/?>|<!--/i
/** A table delimiter row: only pipes, colons, dashes and spaces, with at least one pipe and one dash. */
function isTableDelimiter(line: string): boolean {
  return line.includes('|') && line.includes('-') && /^[\s|:-]+$/.test(line)
}

const TASK_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+\[[ x]\](?:\s|$)/i
const FOOTNOTE = /\[\^[^\]\s]+\]/
const INLINE_CODE = /(?<!`)(`+)(?!`)(.*?[^`])\1(?!`)/g

/** Reads a fence opening line: three or more backticks or tildes, then the info string. */
function openingFence(line: string): {
 char: string
size: number
info: string
} | undefined {
  const text = line.trimStart()
  const char = text[0]
  if (char !== '`' && char !== '~') {
    return undefined
  }
  let size = 0
  while (text[size] === char) {
    size++
  }
  const info = text.slice(size).trim()
  // A backtick fence cannot have a backtick in its info string.
  return size >= 3 && !(char === '`' && info.includes('`')) ? { char, size, info } : undefined
}

/**
 * Finds Markdown syntax that the visual editor would lose on save: MDC
 * blocks (`::note`) and inline components (`:icon{name=x}`), attributes
 * after a link or code (`[a](b){.c}`), HTML tags, GFM tables, task lists,
 * footnotes, and a code fence with more than a language in its info string.
 * Text inside a code fence or an inline code span is plain code, so it is
 * ignored (except the fence info). It returns one issue per kind, with the
 * first line of that kind. An empty list means the text is safe.
 */
export function findUnsafeMarkdown(text: string): UnsafeMarkdownIssue[] {
  const found = new Map<UnsafeMarkdownKind, number>()
  const add = (kind: UnsafeMarkdownKind, line: number) => {
    if (!found.has(kind)) {
      found.set(kind, line)
    }
  }

  const lines = text.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n')
  // The prose lines. A line inside a fence is blank, so line numbers stay.
  const prose: string[] = []
  let fence: {
 char: string
size: number
} | undefined

  for (const [index, line] of lines.entries()) {
    const number = index + 1
    if (fence) {
      const close = new RegExp(`^\\s*${fence.char}{${fence.size},}\\s*$`)
      if (close.test(line)) {
        fence = undefined
      }
      prose.push('')
      continue
    }
    const open = openingFence(line)
    if (open) {
      fence = { char: open.char, size: open.size }
      if (!SAFE_FENCE_INFO.test(open.info)) {
        add('fence-meta', number)
      }
      prose.push('')
      continue
    }
    prose.push(line)
  }

  // Inline code can be followed by MDC attributes: `` `x`{.c} ``.
  const blanked = prose.map((line, index) => {
    return line.replace(INLINE_CODE, (match, _ticks, _body, offset: number) => {
      if (line[offset + match.length] === '{') {
        add('attributes', index + 1)
      }
      return ' '.repeat(match.length)
    })
  })

  for (const [index, line] of blanked.entries()) {
    const number = index + 1
    if (MDC_BLOCK.test(line)) {
      add('mdc-block', number)
    }
    if (MDC_INLINE.test(line)) {
      add('mdc-inline', number)
    }
    if (/[\])]\{/.test(line)) {
      add('attributes', number)
    }
    if (HTML_TAG.test(line)) {
      add('html', number)
    }
    if (TASK_ITEM.test(line)) {
      add('task-list', number)
    }
    if (FOOTNOTE.test(line)) {
      add('footnote', number)
    }
    // A table needs a header row with a pipe, then a delimiter row.
    if (index > 0 && blanked[index - 1]!.includes('|') && isTableDelimiter(line)) {
      add('table', number)
    }
  }

  return [...found].map(([kind, line]) => ({ kind, line }))
}

/**
 * Inserts `snippet` into `value` in place of the selection. The result has
 * the new text and the caret position. With `block`, the snippet gets a blank
 * line before and after it, so it never joins the text next to it.
 */
export function insertMarkdownText(
  value: string,
  selection: {
 start: number
end: number
},
  snippet: string,
  options: {
 block?: boolean
} = {}
): {
 value: string
caret: number
} {
  const start = Math.max(0, Math.min(selection.start, value.length))
  const end = Math.max(start, Math.min(selection.end, value.length))
  let before = value.slice(0, start)
  let after = value.slice(end)
  let text = snippet
  if (options.block) {
    if (before !== '' && !before.endsWith('\n\n')) {
      before += before.endsWith('\n') ? '\n' : '\n\n'
    }
    if (after !== '' && !after.startsWith('\n\n')) {
      after = (after.startsWith('\n') ? '\n' : '\n\n') + after
    }
    text = snippet.replace(/\n+$/, '')
  }
  return { value: `${before}${text}${after}`, caret: before.length + text.length }
}

/**
 * The first mode of the Markdown widget for a field `editor` option and a
 * text. `visual` and `source` are fixed. `auto` (or no option) opens Source
 * when the text has syntax that the visual editor cannot keep.
 */
export function pickMarkdownEditorMode(editor: 'auto' | 'visual' | 'source' | undefined, text: string): 'visual' | 'source' {
  if (editor === 'visual' || editor === 'source') {
    return editor
  }
  return findUnsafeMarkdown(text).length > 0 ? 'source' : 'visual'
}
