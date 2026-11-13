import { Extension } from '@tiptap/core'

const LAYER_ATTRIBUTES = new Set(['aria-hidden', 'data-aria-hidden', 'inert'])

interface DomObserver {
  registerMutation?: (mutation: MutationRecord, added: Node[]) => unknown
}

/**
 * A select, a menu or a modal of Reka UI (Nuxt UI) hides the rest of the page from screen readers
 * while it is open: it sets `aria-hidden` on the elements around it, and that can reach the
 * paragraphs of the editor. ProseMirror read those attribute changes as an edit of the text: it
 * read the DOM again, moved the selection and drew the nearby blocks again, so the settings
 * popover of a component closed when its Type select opened, and the editor scrolled. This
 * extension makes ProseMirror ignore these attributes: they are never content. It wraps
 * `registerMutation` of the DOM observer of prosemirror-view (an internal method: `null` ignores
 * a mutation).
 */
export const PlutoIgnoreAriaHidden = Extension.create({
  name: 'plutoIgnoreAriaHidden',

  onCreate() {
    const observer = (
      this.editor.view as unknown as { domObserver?: DomObserver }
    ).domObserver
    if (typeof observer?.registerMutation !== 'function') {
      return
    }
    const register = observer.registerMutation.bind(observer)
    observer.registerMutation = (mutation, added) =>
      mutation.type === 'attributes' &&
      LAYER_ATTRIBUTES.has(mutation.attributeName ?? '')
        ? null
        : register(mutation, added)
  },
})
