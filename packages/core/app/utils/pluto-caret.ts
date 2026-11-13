import type { Editor } from '@tiptap/core'

const MARKER = ''

const CONTEXT = 24

/**
 * The offset in `value` of the caret of the Visual editor: the document with the marker at the
 * caret, written as Markdown. The editor writes `value` itself after an edit, so the offset is
 * exact; on a post that it did not write yet (`_italic_` for `*italic*`), the text before the
 * caret finds the place, near the offset.
 */
export function plutoMarkdownCaret(editor: Editor, value: string): number {
  const { state } = editor
  const doc = state.tr.insertText(MARKER, state.selection.head).doc
  const markdown = editor.markdown?.serialize(doc.toJSON()) ?? ''
  const at = markdown.indexOf(MARKER)
  if (at < 0) {
    return 0
  }
  if (markdown.replace(MARKER, '').trimEnd() === value.trimEnd()) {
    return Math.min(at, value.length)
  }
  const before = markdown.slice(Math.max(0, at - CONTEXT), at)
  if (!before) {
    return 0
  }
  let best = -1
  for (
    let i = value.indexOf(before);
    i >= 0;
    i = value.indexOf(before, i + 1)
  ) {
    if (best < 0 || Math.abs(i - at) < Math.abs(best - at)) {
      best = i
    }
  }
  return best >= 0 ? best + before.length : Math.min(at, value.length)
}

/**
 * The position in the Visual editor of an offset of `value`: the Markdown with the marker at the
 * offset, read by the editor; the marker is in the n-th text block at some offset, and the same text
 * block of the editor gets the caret. A video line (`plutoEmbedSource`) is a block, not a text block,
 * in the editor, so it does not count. `null` when the marker is lost (inside a mark of the syntax).
 */
export function plutoVisualCaret(
  editor: Editor,
  value: string,
  offset: number
): number | null {
  const at = Math.min(Math.max(Math.trunc(offset), 0), value.length)
  const json = editor.markdown?.parse(
    value.slice(0, at) + MARKER + value.slice(at)
  )
  if (!json) {
    return null
  }
  const parsed = editor.schema.nodeFromJSON(json)
  const isTextBlock = (node: {
    isTextblock: boolean
    attrs: Record<string, unknown>
  }) => node.isTextblock && !node.attrs.plutoEmbedSource
  let index = -1
  let target: { block: number; offset: number } | null = null
  parsed.descendants((node) => {
    if (target) {
      return false
    }
    if (isTextBlock(node)) {
      index++
      const found = node.textContent.indexOf(MARKER)
      if (found >= 0) {
        target = { block: index, offset: found }
      }
      return false
    }
    return true
  })
  if (!target) {
    return null
  }
  const { block, offset: inBlock } = target
  let count = -1
  let position: number | null = null
  editor.state.doc.descendants((node, pos) => {
    if (position !== null) {
      return false
    }
    if (isTextBlock(node)) {
      count++
      if (count === block) {
        position = pos + 1 + Math.min(inBlock, node.content.size)
      }
      return false
    }
    return true
  })
  return position
}

/** A caret kept between visits: its offset in the Markdown, and the text just before it. */
export interface PlutoCaretAnchor {
  offset: number
  before: string
}

/** The anchor of an offset of `value`. */
export function plutoCaretAnchor(
  value: string,
  offset: number
): PlutoCaretAnchor {
  const at = Math.min(Math.max(Math.trunc(offset), 0), value.length)
  return { offset: at, before: value.slice(Math.max(0, at - CONTEXT), at) }
}

/**
 * The offset of an anchor in `value`, which may be written a little differently now (the file
 * on disk, not the text of the editor): after the occurrence of its text nearest to its offset,
 * else its offset.
 */
export function plutoFindCaret(
  value: string,
  anchor: PlutoCaretAnchor
): number {
  const { offset, before } = anchor
  if (!before) {
    return Math.min(offset, value.length)
  }
  let best = -1
  for (
    let i = value.indexOf(before);
    i >= 0;
    i = value.indexOf(before, i + 1)
  ) {
    if (
      best < 0 ||
      Math.abs(i + before.length - offset) <
        Math.abs(best + before.length - offset)
    ) {
      best = i
    }
  }
  return best >= 0 ? best + before.length : Math.min(offset, value.length)
}
