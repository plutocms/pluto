// Edit operations on a block doc. Each one is pure: it returns a new doc and
// never changes its input. An edit removes `original` from the edited block and
// from its ancestors, so only those blocks are built again on save. The gaps
// stay where they are, so the layout of the other blocks does not change.

import type {
  PlutoBlock,
  PlutoBlockDoc,
  PlutoCodeBlock,
  PlutoComponentBlock,
  PlutoPropValue,
} from './types'
import { completeOrder } from './mdc-props'
import { dedent, parseBlocks } from './parse'
import { renderBlock } from './serialize'
import { findBlock, flatChildren, newBlockId, pathOf } from './tree'

/** Where a block goes: a list of the doc, or a slot of a component. `index` is the position in that list. */
export interface PlutoBlockTarget {
  parentId?: string
  slot?: string
  index: number
}

export interface PlutoInsertResult {
  doc: PlutoBlockDoc
  /** The ids of the new blocks. */
  ids: string[]
}

// Clone and dirty marks

function cloneDoc(doc: PlutoBlockDoc): PlutoBlockDoc {
  // A JSON copy also works for a reactive proxy.
  return JSON.parse(JSON.stringify(doc)) as PlutoBlockDoc
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** Removes `original` from the block and from its ancestors. */
function touch(doc: PlutoBlockDoc, id: string): void {
  for (const pathId of pathOf(doc, id)) {
    const found = findBlock(doc, pathId)
    if (found) {
      delete found.block.original
    }
  }
}

function renewIds(block: PlutoBlock): PlutoBlock {
  block.id = newBlockId()
  if (block.kind === 'component') {
    for (const child of flatChildren(block)) {
      renewIds(child)
    }
  }
  return block
}

// Indent

/**
 * Changes the indent of the lines after the first one. A gap ends before a
 * block, so a line end at the end of the text also gets the indent.
 */
function shiftText(text: string, from: string, to: string): string {
  return text.replace(
    /\n([ \t]*)(?=[^\n]|$)/g,
    (_match, white: string) =>
      `\n${to}${white.startsWith(from) ? white.slice(from.length) : white}`
  )
}

/** A block with a new indent. A block that moves to another level is built again on save. */
function withIndent(block: PlutoBlock, indent: string): PlutoBlock {
  const from = block.indent ?? ''
  if (from === indent) {
    return block
  }
  delete block.original
  if (indent) {
    block.indent = indent
  } else {
    delete block.indent
  }
  if (block.kind === 'component') {
    block.gaps = block.gaps.map((gap) => shiftText(gap, from, indent))
    block.openerText = shiftText(block.openerText, from, indent)
    if (block.yamlHead !== undefined) {
      block.yamlHead = shiftText(block.yamlHead, from, indent)
    }
    if (block.yamlIndent !== undefined) {
      block.yamlIndent = block.yamlIndent.startsWith(from)
        ? indent + block.yamlIndent.slice(from.length)
        : block.yamlIndent
    }
    for (const child of flatChildren(block)) {
      const childIndent = child.indent ?? ''
      withIndent(
        child,
        childIndent.startsWith(from)
          ? indent + childIndent.slice(from.length)
          : indent
      )
    }
  }
  return block
}

// Lists

interface ListView {
  blocks: PlutoBlock[]
  /** The gaps that belong to the list: `gaps[start]` is the gap before the first block. */
  gaps: string[]
  start: number
  parent?: PlutoComponentBlock
  slot?: string
  /** The slot has no entry yet. */
  missing: boolean
}

function viewOf(
  doc: PlutoBlockDoc,
  parentId?: string,
  slot = 'default'
): ListView | undefined {
  if (parentId === undefined) {
    return { blocks: doc.blocks, gaps: doc.gaps, start: 0, missing: false }
  }
  const parent = findBlock(doc, parentId)?.block
  if (parent?.kind !== 'component') {
    return undefined
  }
  let start = 0
  for (const [name, children] of Object.entries(parent.slots)) {
    if (name === slot) {
      return {
        blocks: children,
        gaps: parent.gaps,
        start,
        parent,
        slot,
        missing: false,
      }
    }
    start += children.length
  }
  // A default slot with no entry goes first. Another missing slot goes last.
  return {
    blocks: [],
    gaps: parent.gaps,
    start: slot === 'default' ? 0 : start,
    parent,
    slot,
    missing: true,
  }
}

const MARKER = /^[ \t]*#[a-z][\w-]*[ \t]*$/gim

/** The text of a gap up to the end of its last `#name` line, or an empty text. */
function markerPrefix(gap: string): string {
  let end = -1
  for (const match of gap.matchAll(MARKER)) {
    end = match.index + match[0].length
  }
  return end === -1 ? '' : gap.slice(0, end)
}

function markerLine(gap: string, slot: string): { end: number } | undefined {
  for (const match of gap.matchAll(MARKER)) {
    if (match[0].trim() === `#${slot}`) {
      return { end: match.index + match[0].length }
    }
  }
  return undefined
}

/** The indent for a new child: the one of the sibling next to it, or a default. */
function childIndentFor(
  view: ListView,
  index: number,
  block: PlutoBlock
): string {
  if (!view.parent) {
    return ''
  }
  const sibling =
    view.blocks[Math.min(index, view.blocks.length - 1)] ??
    flatChildren(view.parent)[0]
  if (sibling) {
    return sibling.indent ?? ''
  }
  const base = view.parent.indent ?? ''
  return block.kind === 'component' ? `${base}  ` : base
}

/** The gap between two blocks of a list. It is a blank line, plus the indent in a component. */
function separatorFor(view: ListView, indent: string): string {
  return view.parent ? `\n\n${indent}` : '\n\n'
}

/** The gaps between the new blocks, indented for a component. */
function innerGapsFor(gaps: string[], indent: string): string[] {
  return gaps.map((gap) =>
    indent && gap.includes('\n')
      ? `${gap.replace(/[ \t]*$/, '')}${indent}`
      : gap
  )
}

/** Puts blocks into an empty list: the doc, or a slot with no child. */
function fillEmpty(
  view: ListView,
  blocks: PlutoBlock[],
  inner: string[]
): void {
  const { parent } = view
  if (!parent) {
    view.gaps.splice(0, view.gaps.length, '', ...inner, '\n')
    view.blocks.push(...blocks)
    return
  }
  const indent = blocks[0]!.indent ?? ''
  const slot = view.slot!
  // Where the slot starts: after its `#name` line, or at the start of the content.
  let at = view.start
  let cut: number | undefined
  const marker = markerLine(parent.gaps[at] ?? '', slot)
  if (marker) {
    cut = marker.end
  } else if (slot === 'default') {
    cut = 0
  }
  if (cut !== undefined) {
    const gap = parent.gaps[at]!
    parent.gaps.splice(
      at,
      1,
      `${gap.slice(0, cut)}\n${indent}`,
      ...inner,
      gap.slice(cut) || '\n'
    )
    parent.slots[slot] = view.blocks
    view.blocks.push(...blocks)
    if (slot === 'default' && view.missing) {
      // Content before the first `#name` goes first in the record.
      const { default: own, ...rest } = parent.slots
      parent.slots = { default: own!, ...rest }
    }
    return
  }
  // A named slot with no entry: add a `#name` section at the end.
  at = parent.gaps.length - 1
  const last = parent.gaps[at]!
  const closing = /\n[ \t]*$/.exec(last)
  const base = closing ? last.slice(0, closing.index) : last
  const closeGap = closing ? closing[0] : '\n'
  parent.gaps.splice(
    at,
    1,
    `${base}\n${parent.indent ?? ''}#${slot}\n${indent}`,
    ...inner,
    closeGap
  )
  parent.slots[slot] = view.blocks
  view.blocks.push(...blocks)
}

/**
 * Replaces `count` blocks at `index` with new blocks. `inner` has the gaps
 * between the new blocks. Insert is `count` 0, remove is no new block.
 */
function spliceList(
  view: ListView,
  index: number,
  count: number,
  blocks: PlutoBlock[],
  inner: string[]
): void {
  const { gaps } = view
  const f = view.start + index
  if (count === 0 && view.blocks.length === 0) {
    if (blocks.length > 0) {
      fillEmpty(view, blocks, inner)
    }
    return
  }
  if (count === 0) {
    const sep = separatorFor(view, blocks[0]!.indent ?? '')
    if (index === 0) {
      gaps.splice(f + 1, 0, ...inner, sep)
    } else {
      gaps.splice(f, 0, sep, ...inner)
    }
    view.blocks.splice(index, 0, ...blocks)
    return
  }
  if (blocks.length === 0) {
    // Remove: join the gap before and the gap after.
    const before = gaps[f] ?? ''
    const after = gaps[f + count] ?? ''
    const rest = view.blocks.length - count
    let merged: string
    if (!view.parent && f === 0) {
      merged = rest > 0 ? before : before + after
    } else {
      merged = markerPrefix(before) + after
    }
    gaps.splice(f, count + 1, merged)
    view.blocks.splice(index, count)
    return
  }
  // Replace: keep the outer gaps, change the inner ones.
  gaps.splice(f + 1, count - 1, ...inner)
  view.blocks.splice(index, count, ...blocks)
}

/** A nested component needs more colons than its parent. */
function ensureColons(block: PlutoBlock, min: number): void {
  if (block.kind !== 'component') {
    return
  }
  if (block.colons < min) {
    block.colons = min
    block.openerText = block.openerText.replace(/^:+/, ':'.repeat(min))
    delete block.original
  }
  for (const child of flatChildren(block)) {
    ensureColons(child, block.colons + 1)
  }
}

function prepare(view: ListView, index: number, blocks: PlutoBlock[]): void {
  const indent = childIndentFor(view, index, blocks[0]!)
  for (const block of blocks) {
    withIndent(block, view.parent ? indent : '')
    if (view.parent) {
      ensureColons(block, view.parent.colons + 1)
    }
  }
}

// Make blocks

/** Parses Markdown into new blocks, with fresh ids. The text between them is in `gaps`. */
export function blocksFromMarkdown(markdown: string): {
  blocks: PlutoBlock[]
  gaps: string[]
} {
  const doc = parseBlocks(markdown.replace(/^(?:[ \t]*\n)+/, '').trimEnd())
  return {
    blocks: doc.blocks.map((block) => renewIds(block)),
    gaps: doc.gaps.slice(1, -1),
  }
}

export function createTextBlock(markdown: string): PlutoBlock {
  return { id: newBlockId(), kind: 'text', markdown }
}

export function createCodeBlock(code = '', lang = ''): PlutoBlock {
  return { id: newBlockId(), kind: 'code', lang, fence: '```', code }
}

export function createComponentBlock(
  name: string,
  props: Record<string, PlutoPropValue> = {},
  content?: string
): PlutoBlock {
  const text = content ? `\n${content}\n` : '\n'
  const block = parseBlocks(`::${name}${text}::`).blocks[0]
  if (block?.kind !== 'component') {
    throw new Error(`Cannot make a component from the name "${name}".`)
  }
  renewIds(block)
  for (const [key, value] of Object.entries(props)) {
    block.props[key] = value
    block.propOrder.push(key)
  }
  delete block.original
  return block
}

// Operations

/** Puts blocks at a target. It returns `undefined` when the target does not exist. */
export function insertBlocks(
  doc: PlutoBlockDoc,
  blocks: PlutoBlock[],
  target: PlutoBlockTarget,
  gaps: string[] = []
): PlutoInsertResult | undefined {
  if (blocks.length === 0) {
    return { doc, ids: [] }
  }
  const next = cloneDoc(doc)
  const view = viewOf(next, target.parentId, target.slot)
  if (!view) {
    return undefined
  }
  const fresh = blocks.map((block) => clone(block))
  const index = Math.max(0, Math.min(target.index, view.blocks.length))
  prepare(view, index, fresh)
  const indent = view.parent ? (fresh[0]!.indent ?? '') : ''
  spliceList(
    view,
    index,
    0,
    fresh,
    innerGapsFor(
      gaps.length === fresh.length - 1
        ? gaps
        : fresh.slice(1).map(() => '\n\n'),
      indent
    )
  )
  if (target.parentId !== undefined) {
    touch(next, target.parentId)
  }
  return { doc: next, ids: fresh.map((block) => block.id) }
}

export function insertBlock(
  doc: PlutoBlockDoc,
  block: PlutoBlock,
  target: PlutoBlockTarget
): PlutoInsertResult | undefined {
  return insertBlocks(doc, [block], target)
}

export function removeBlock(doc: PlutoBlockDoc, id: string): PlutoBlockDoc {
  const next = cloneDoc(doc)
  const found = findBlock(next, id)
  if (!found) {
    return doc
  }
  const view = viewOf(next, found.parent?.id, found.slot)!
  if (found.parent) {
    touch(next, found.parent.id)
  }
  spliceList(view, found.index, 1, [], [])
  return next
}

/** Moves a block. `target.index` is the position in the target list after the move. */
export function moveBlock(
  doc: PlutoBlockDoc,
  id: string,
  target: PlutoBlockTarget
): PlutoBlockDoc {
  const found = findBlock(doc, id)
  if (!found) {
    return doc
  }
  // A block cannot go into itself.
  if (
    target.parentId !== undefined &&
    pathOf(doc, target.parentId).includes(id)
  ) {
    return doc
  }
  const sameList =
    found.parent?.id === target.parentId &&
    (found.slot ?? 'default') === (target.slot ?? 'default')
  if (sameList) {
    const next = cloneDoc(doc)
    const located = findBlock(next, id)!
    const view = viewOf(next, target.parentId, target.slot)!
    const index = Math.max(0, Math.min(target.index, view.blocks.length - 1))
    if (index === located.index) {
      return doc
    }
    // Only the order of the blocks changes. The gaps stay in place.
    const [block] = view.blocks.splice(located.index, 1)
    view.blocks.splice(index, 0, block!)
    if (target.parentId !== undefined) {
      touch(next, target.parentId)
    }
    return next
  }
  const moving = clone(found.block)
  const removed = removeBlock(doc, id)
  // The moved block keeps its id.
  const inserted = insertBlocks(removed, [moving], target)
  if (!inserted) {
    return doc
  }
  return inserted.doc
}

/** Copies a block and puts the copy after it. */
export function duplicateBlock(
  doc: PlutoBlockDoc,
  id: string
): PlutoInsertResult | undefined {
  const found = findBlock(doc, id)
  if (!found) {
    return undefined
  }
  const copy = renewIds(clone(found.block))
  return insertBlocks(doc, [copy], {
    parentId: found.parent?.id,
    slot: found.slot,
    index: found.index + 1,
  })
}

/** Edits a block with a function on a copy. A no-op edit returns the same doc. */
function editBlock(
  doc: PlutoBlockDoc,
  id: string,
  edit: (block: PlutoBlock) => boolean
): PlutoBlockDoc {
  const next = cloneDoc(doc)
  const found = findBlock(next, id)
  if (!found || !edit(found.block)) {
    return doc
  }
  touch(next, id)
  return next
}

export function updateText(
  doc: PlutoBlockDoc,
  id: string,
  markdown: string
): PlutoBlockDoc {
  return editBlock(doc, id, (block) => {
    if (
      (block.kind !== 'text' && block.kind !== 'raw') ||
      block.markdown === markdown
    ) {
      return false
    }
    block.markdown = markdown
    return true
  })
}

export function updateCode(
  doc: PlutoBlockDoc,
  id: string,
  patch: Partial<Pick<PlutoCodeBlock, 'lang' | 'filename' | 'meta' | 'code'>>
): PlutoBlockDoc {
  return editBlock(doc, id, (block) => {
    if (block.kind !== 'code') {
      return false
    }
    let changed = false
    for (const [key, value] of Object.entries(patch) as Array<
      [keyof typeof patch, string | undefined]
    >) {
      if (block[key] !== value) {
        changed = true
        if (
          value === undefined ||
          (value === '' && key !== 'code' && key !== 'lang')
        ) {
          delete block[key]
        } else {
          block[key] = value
        }
      }
    }
    return changed
  })
}

/** Sets a prop of a component. A value of `undefined` removes the prop. */
export function setProp(
  doc: PlutoBlockDoc,
  id: string,
  key: string,
  value: PlutoPropValue
): PlutoBlockDoc {
  return editBlock(doc, id, (block) => {
    if (block.kind !== 'component') {
      return false
    }
    if (value === undefined) {
      if (!(key in block.props)) {
        return false
      }
      delete block.props[key]
      return true
    }
    if (
      JSON.stringify(block.props[key]) === JSON.stringify(value) &&
      key in block.props
    ) {
      return false
    }
    block.props[key] = value
    block.propOrder = completeOrder(block.props, block.propOrder)
    return true
  })
}

/** Replaces all children of a slot with the blocks parsed from Markdown. */
export function setSlot(
  doc: PlutoBlockDoc,
  id: string,
  slot: string,
  markdown: string
): PlutoBlockDoc {
  const found = findBlock(doc, id)
  if (found?.block.kind !== 'component') {
    return doc
  }
  const current = found.block.slots[slot] ?? []
  const parsed = blocksFromMarkdown(markdown)
  // The same text gives the same doc.
  if (
    current.length > 0 &&
    parsed.blocks.length > 0 &&
    current.length === parsed.blocks.length
  ) {
    const same = current.every(
      (child, index) =>
        (child.kind === 'text' || child.kind === 'raw') &&
        parsed.blocks[index]!.kind === child.kind &&
        (parsed.blocks[index] as typeof child).markdown === child.markdown
    )
    if (same) {
      return doc
    }
  }
  const next = cloneDoc(doc)
  const view = viewOf(next, id, slot)!
  const parent = view.parent!
  touch(next, id)
  const blocks = parsed.blocks
  const indent = blocks.length > 0 ? childIndentFor(view, 0, blocks[0]!) : ''
  for (const block of blocks) {
    withIndent(block, indent)
    ensureColons(block, parent.colons + 1)
  }
  const inner = innerGapsFor(parsed.gaps, indent)
  if (view.blocks.length > 0) {
    spliceList(view, 0, view.blocks.length, blocks, inner)
  } else if (blocks.length > 0) {
    spliceList(view, 0, 0, blocks, inner)
  }
  parent.slots = { ...parent.slots }
  return next
}

/** Replaces a block with the blocks parsed from Markdown. */
export function replaceWithMarkdown(
  doc: PlutoBlockDoc,
  id: string,
  markdown: string
): PlutoInsertResult | undefined {
  const found = findBlock(doc, id)
  if (!found) {
    return undefined
  }
  const parsed = blocksFromMarkdown(markdown)
  const next = cloneDoc(doc)
  const at = findBlock(next, id)!
  const view = viewOf(next, at.parent?.id, at.slot)!
  if (at.parent) {
    touch(next, at.parent.id)
  }
  const indent = at.block.indent ?? ''
  for (const block of parsed.blocks) {
    withIndent(block, indent)
    if (view.parent) {
      ensureColons(block, view.parent.colons + 1)
    }
  }
  spliceList(
    view,
    at.index,
    1,
    parsed.blocks,
    innerGapsFor(parsed.gaps, indent)
  )
  return { doc: next, ids: parsed.blocks.map((block) => block.id) }
}

/** The block as plain Markdown text, for "Edit as Markdown". */
export function blockMarkdown(block: PlutoBlock): string {
  if (block.kind === 'text' || block.kind === 'raw') {
    return block.markdown
  }
  return dedent(renderBlock(block), block.indent ?? '')
}
