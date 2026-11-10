import type { Editor } from '@tiptap/core'
import { Extension } from '@tiptap/core'

/** Adds an empty paragraph at the end of the document when the last block is not one. */
function ensureTrailingParagraph(editor: Editor) {
  const { doc, schema } = editor.state
  const paragraph = schema.nodes.paragraph
  const last = doc.lastChild
  if (!paragraph || (last?.type === paragraph && last.content.size === 0)) {
    return
  }
  editor.view.dispatch(
    editor.state.tr
      .insert(doc.content.size, paragraph.create())
      // Not a change of the author: Undo skips it.
      .setMeta('addToHistory', false)
  )
}

/**
 * Keeps an empty line at the end of the post editor, so the "+" of the block menu always has a
 * place below the last block. The Markdown of the editor drops it (`PlutoFieldMarkdown` trims the
 * trailing blank lines), so it never reaches the file.
 */
export const PlutoTrailingParagraph = Extension.create({
  name: 'plutoTrailingParagraph',
  onCreate() {
    ensureTrailingParagraph(this.editor)
  },
  onUpdate() {
    ensureTrailingParagraph(this.editor)
  },
})
