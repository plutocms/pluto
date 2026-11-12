import type { NodeViewRenderer } from '@tiptap/core'
import type { Component } from 'vue'
import { VueNodeViewRenderer } from '@tiptap/vue-3'

/**
 * The node view of an atom block with its own controls (the chip of a content component, the
 * video block): a Vue component, and ProseMirror ignores every change of its DOM. Tiptap ignores the
 * attribute and the child changes of an atom, but not a selection in it: a focus on a button of the
 * block (a popover gives the focus back to its trigger) made ProseMirror read that selection, mark
 * the block changed and draw it again. The component unmounted (its popover closed) and the editor
 * scrolled. The block changes only through its node (`updateAttributes`), never through its DOM.
 */
export function plutoAtomNodeView(component: Component): NodeViewRenderer {
  const render = VueNodeViewRenderer(component)
  return (props) => {
    const view = render(props) as ReturnType<NodeViewRenderer> & {
      ignoreMutation?: (mutation: unknown) => boolean
    }
    view.ignoreMutation = () => true
    return view
  }
}
