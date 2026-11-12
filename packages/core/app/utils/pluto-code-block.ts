import type { NodeViewRenderer } from '@tiptap/core'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import { common, createLowlight } from 'lowlight'
import PlutoEditorCodeBlock from '../components/Pluto/Editor/PlutoEditorCodeBlock.vue'

/**
 * The code block of the Visual editor: the code block of Tiptap, colored by its language
 * (lowlight, with the `common` grammars of highlight.js), and a language select
 * (`PlutoEditorCodeBlock`). The Markdown stays a fence with the language as its info (```ts). The
 * editor turns the code block of the StarterKit off (`starter-kit="{ codeBlock: false }"`): this
 * one has the same name, so the toolbar and the "/" menu use it.
 */
export const PlutoCodeBlock = CodeBlockLowlight.extend({
  addNodeView(): NodeViewRenderer {
    return VueNodeViewRenderer(PlutoEditorCodeBlock)
  },
}).configure({
  lowlight: createLowlight(common),
  defaultLanguage: null,
})
