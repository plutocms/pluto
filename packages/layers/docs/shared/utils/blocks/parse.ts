// Cut a Markdown (MDC) text into blocks. Each block keeps the exact text it
// came from, and the doc keeps the text between the blocks, so a save with no
// edit writes the same bytes. The parser is `remark-mdc` on `remark-parse`:
// pin the versions to the ones of `@nuxtjs/mdc`.

import type {
  PlutoBlock,
  PlutoBlockDoc,
  PlutoCodeBlock,
  PlutoComponentBlock,
  PlutoRawBlock,
  PlutoRawReason,
  PlutoSlice,
  PlutoTextBlock,
} from './types'
import remarkGfm from 'remark-gfm'
import remarkMdc from 'remark-mdc'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { parseInlineProps, parseOpener, parseYamlProps } from './mdc-props'
import { flatChildren } from './tree'

interface MdNode {
  type: string
  name?: string
  depth?: number
  lang?: string | null
  meta?: string | null
  checked?: boolean | null
  children?: MdNode[]
  position?: { start: { offset?: number }; end: { offset?: number } }
}

interface Context {
  source: string
  nextId: () => string
}

/** A block with the range of the source that it covers. */
interface Entry {
  block: PlutoBlock
  start: number
  end: number
}

const SAFE_TYPES = new Set([
  'paragraph',
  'heading',
  'list',
  'listItem',
  'blockquote',
  'thematicBreak',
  'definition',
  'text',
  'emphasis',
  'strong',
  'delete',
  'inlineCode',
  'link',
  'linkReference',
  'image',
  'imageReference',
  'break',
])

const PROSE_TYPES = new Set([
  'paragraph',
  'heading',
  'list',
  'blockquote',
  'thematicBreak',
  'definition',
])

/** The reason why the visual editor cannot keep a piece of prose, or `undefined` when it can. */
function unsafeReason(
  node: MdNode,
  source: string
): PlutoRawReason | undefined {
  switch (node.type) {
    case 'html':
      return 'html'
    case 'table':
      return 'table'
    case 'footnoteReference':
    case 'footnoteDefinition':
      return 'footnote'
    case 'textComponent':
      // The parser reads a footnote reference as a text span.
      return source.startsWith('[^', node.position!.start.offset!)
        ? 'footnote'
        : 'inline-mdc'
    case 'containerComponent':
    case 'leafComponent':
      return 'inline-mdc'
    case 'code':
      // A fenced code inside a list or a quote: only a plain language is safe.
      return node.meta ? 'unknown' : undefined
  }
  if (!SAFE_TYPES.has(node.type)) {
    return 'unknown'
  }
  if (
    node.type === 'listItem' &&
    node.checked !== null &&
    node.checked !== undefined
  ) {
    return 'task-list'
  }
  for (const child of node.children ?? []) {
    const reason = unsafeReason(child, source)
    if (reason) {
      return reason
    }
  }
  return undefined
}

function range(node: MdNode): [number, number] {
  return [node.position!.start.offset!, node.position!.end.offset!]
}

function lineStartOf(source: string, offset: number): number {
  return source.lastIndexOf('\n', offset - 1) + 1
}

/** The white space before a node, on its first line. */
function indentOf(source: string, start: number): string {
  const before = source.slice(lineStartOf(source, start), start)
  return /^[ \t]*$/.test(before) ? before : ''
}

/** Removes the indent from each line but the first. */
export function dedent(text: string, indent: string): string {
  if (!indent) {
    return text
  }
  return text
    .split('\n')
    .map((line, index) =>
      index > 0 && line.startsWith(indent) ? line.slice(indent.length) : line
    )
    .join('\n')
}

/** Removes the indent from every line. */
function dedentAll(text: string, indent: string): string {
  return text
    .split('\n')
    .map((line) => (line.startsWith(indent) ? line.slice(indent.length) : line))
    .join('\n')
}

function sliceOf(source: string, start: number, end: number): PlutoSlice {
  return { start, end, text: source.slice(start, end) }
}

function parseCode(ctx: Context, node: MdNode): Entry {
  const [start, end] = range(node)
  const indent = indentOf(ctx.source, start)
  const text = ctx.source.slice(start, end)
  const lines = dedent(text, indent).split('\n')
  const first = lines[0]!.replace(/\r$/, '')
  let fenceLength = 0
  while (first[fenceLength] === first[0]) {
    fenceLength++
  }
  const fence = fenceLength >= 3 ? first.slice(0, fenceLength) : '```'
  const info = first.slice(fenceLength).trim()
  const closing =
    lines.length > 1 ? /^[ \t]*([`~]{3,})[ \t]*\r?$/.exec(lines.at(-1)!) : null
  const closed =
    closing !== null &&
    closing[1]![0] === fence[0] &&
    closing[1]!.length >= fence.length
  const code = lines.slice(1, closed ? -1 : undefined).join('\n')

  // The language is the first word. A file name or a flag can follow.
  const langEnd = info.search(/[\s[{]/)
  const lang = langEnd === -1 ? info : info.slice(0, langEnd)
  let rest = info.slice(lang.length).trim()
  let filename: string | undefined
  const nameMatch = /\[([^\]]*)\]/.exec(rest)
  if (nameMatch) {
    filename = nameMatch[1]
    rest =
      `${rest.slice(0, nameMatch.index)}${rest.slice(nameMatch.index + nameMatch[0].length)}`
        .replace(/\s+/g, ' ')
        .trim()
  }
  const block: PlutoCodeBlock = {
    id: ctx.nextId(),
    kind: 'code',
    lang,
    fence,
    code,
    original: sliceOf(ctx.source, start, end),
    ...(indent ? { indent } : {}),
    ...(filename === undefined ? {} : { filename }),
    ...(rest ? { meta: rest } : {}),
  }
  return { block, start, end }
}

function parseRaw(
  ctx: Context,
  start: number,
  end: number,
  reason: PlutoRawReason
): Entry {
  const indent = indentOf(ctx.source, start)
  const original = sliceOf(ctx.source, start, end)
  const block: PlutoRawBlock = {
    id: ctx.nextId(),
    kind: 'raw',
    reason,
    markdown: dedent(original.text, indent),
    original,
    ...(indent ? { indent } : {}),
  }
  return { block, start, end }
}

function parseText(ctx: Context, start: number, end: number): Entry {
  const indent = indentOf(ctx.source, start)
  const original = sliceOf(ctx.source, start, end)
  const block: PlutoTextBlock = {
    id: ctx.nextId(),
    kind: 'text',
    markdown: dedent(original.text, indent),
    original,
    ...(indent ? { indent } : {}),
  }
  return { block, start, end }
}

const YAML_BLOCK =
  /^(\r?\n[ \t]*)---[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*---[ \t]*(?=\r?\n|$)/

/** The common white space at the start of the non-blank lines. */
function commonIndent(text: string): string {
  let common: string | undefined
  for (const line of text.split('\n')) {
    if (line.trim() === '') {
      continue
    }
    const lead = /^[ \t]*/.exec(line)![0]
    if (common === undefined) {
      common = lead
      continue
    }
    let index = 0
    while (index < common.length && common[index] === lead[index]) {
      index++
    }
    common = common.slice(0, index)
  }
  return common ?? ''
}

function parseComponent(ctx: Context, node: MdNode): Entry {
  const { source } = ctx
  const [start, end] = range(node)
  const rawFallback = () => parseRaw(ctx, start, end, 'unknown')

  const lineEnd = source.indexOf('\n', start)
  const line = source
    .slice(start, lineEnd === -1 ? source.length : lineEnd)
    .replace(/\r$/, '')
  const opener = parseOpener(line)
  if (!opener) {
    return rawFallback()
  }
  const closer = ':'.repeat(opener.colons)
  const openerEnd = start + line.length
  const closerStart = end - opener.colons
  if (source.slice(closerStart, end) !== closer || closerStart < openerEnd) {
    return rawFallback()
  }

  // The children by slot. `default` is the content before the first `#name`.
  const slots: Record<string, PlutoBlock[]> = {}
  const entries: Entry[] = []
  const take = (name: string, nodes: MdNode[]) => {
    const parsed = parseNodes(ctx, nodes, false)
    entries.push(...parsed)
    slots[name] = [
      ...(slots[name] ?? []),
      ...parsed.map((entry) => entry.block),
    ]
  }
  // Content before the first `#name` is `default`. After a section, loose content
  // is a `#default` section: the parser keeps no node for that marker.
  let loose: MdNode[] = []
  const flushLoose = () => {
    if (loose.length > 0) {
      take('default', loose)
      loose = []
    }
  }
  for (const child of node.children ?? []) {
    if (child.type === 'componentContainerSection') {
      flushLoose()
      take(child.name ?? 'default', child.children ?? [])
      slots[child.name ?? 'default'] ??= []
    } else {
      loose.push(child)
    }
  }
  flushLoose()

  // The children must be in source order, inside the component.
  const ordered = flatChildren({ slots } as PlutoComponentBlock)
  const sorted = ordered.map((block) =>
    entries.find((entry) => entry.block === block)!
  )
  let cursor = openerEnd
  for (const entry of sorted) {
    if (entry.start < cursor || entry.end > closerStart) {
      return rawFallback()
    }
    cursor = entry.end
  }
  const gaps: string[] = []
  cursor = openerEnd
  for (const entry of sorted) {
    gaps.push(source.slice(cursor, entry.start))
    cursor = entry.end
  }
  gaps.push(source.slice(cursor, closerStart))

  let props: ReturnType<typeof parseInlineProps> = {
    props: {},
    order: [],
    source: {},
  }
  let propsStyle: PlutoComponentBlock['propsStyle'] = 'inline'
  let openerText = source.slice(start, openerEnd)
  let yamlHead: string | undefined
  let yamlIndent: string | undefined
  if (opener.braces === undefined) {
    const match = YAML_BLOCK.exec(gaps[0]!)
    if (match) {
      const inner = match[2]!
      const lead = commonIndent(inner)
      const parsed = parseYamlProps(dedentAll(inner, lead))
      if (parsed) {
        props = parsed
        propsStyle = 'yaml'
        yamlHead = match[1]!
        yamlIndent = lead
        openerText += match[0]
        gaps[0] = gaps[0]!.slice(match[0].length)
      }
    }
  } else {
    props = parseInlineProps(opener.braces)
  }

  const indent = indentOf(source, start)
  const block: PlutoComponentBlock = {
    id: ctx.nextId(),
    kind: 'component',
    name: opener.name,
    props: props.props,
    propsStyle,
    propOrder: props.order,
    propSource: props.source,
    colons: opener.colons,
    slots,
    gaps,
    openerText,
    original: sliceOf(source, start, end),
    ...(indent ? { indent } : {}),
    ...(yamlHead === undefined ? {} : { yamlHead, yamlIndent }),
  }
  return { block, start, end }
}

/** Turns sibling nodes into blocks. `top` cuts a Text block at each H1 and H2. */
function parseNodes(ctx: Context, nodes: MdNode[], top: boolean): Entry[] {
  const entries: Entry[] = []
  let group: { start: number; end: number } | undefined

  const flush = () => {
    if (group) {
      entries.push(parseText(ctx, group.start, group.end))
      group = undefined
    }
  }

  for (const node of nodes) {
    if (!node.position) {
      continue
    }
    const [start, end] = range(node)
    if (PROSE_TYPES.has(node.type)) {
      const reason = unsafeReason(node, ctx.source)
      if (reason) {
        flush()
        entries.push(parseRaw(ctx, start, end, reason))
        continue
      }
      if (top && node.type === 'heading' && (node.depth ?? 6) <= 2) {
        flush()
      }
      group = group ? { start: group.start, end } : { start, end }
      continue
    }
    flush()
    if (node.type === 'code') {
      entries.push(parseCode(ctx, node))
    } else if (node.type === 'containerComponent') {
      entries.push(parseComponent(ctx, node))
    } else {
      entries.push(
        parseRaw(ctx, start, end, unsafeReason(node, ctx.source) ?? 'unknown')
      )
    }
  }
  flush()
  return entries
}

/** Cuts a Markdown (MDC) text into a block doc. `serializeBlocks` of the result gives the same text. */
export function parseBlocks(source: string): PlutoBlockDoc {
  const tree = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMdc)
    .parse(source) as unknown as MdNode
  let counter = 0
  const ctx: Context = { source, nextId: () => `b${counter++}` }
  const entries = parseNodes(ctx, tree.children ?? [], true)

  const gaps: string[] = []
  let cursor = 0
  for (const entry of entries) {
    gaps.push(source.slice(cursor, entry.start))
    cursor = entry.end
  }
  gaps.push(source.slice(cursor))
  return { blocks: entries.map((entry) => entry.block), gaps }
}
