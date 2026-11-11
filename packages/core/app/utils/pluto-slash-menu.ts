import type { Editor, Range } from '@tiptap/core'

/**
 * The `allow` test of the "/" menu of an editor (`UEditorSuggestionMenu`, `:suggestion`): no menu
 * for a "/" in code. That is a code block, an inline code mark, and the text after an open
 * backtick that is not closed yet (the inline code that the author is typing: `` `src/ ``).
 */
export function plutoSlashMenuAllowed({
  state,
  range,
}: {
  state: Editor['state']
  range: Range
}): boolean {
  const $from = state.doc.resolve(range.from)
  if ($from.parent.type.spec.code) {
    return false
  }
  const marks = [
    ...$from.marks(),
    ...(state.doc.nodeAt(range.from)?.marks ?? []),
  ]
  if (marks.some((mark) => mark.type.spec.code)) {
    return false
  }
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼')
  return (before.match(/`/g)?.length ?? 0) % 2 === 0
}
