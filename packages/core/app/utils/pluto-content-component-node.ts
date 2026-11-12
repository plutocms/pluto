import type { NodeViewRenderer } from '@tiptap/core'
import type { PlutoPropValue } from '../../shared/utils/blocks/definition'
import { Node } from '@tiptap/core'
import {
  componentStart,
  matchEmptyComponent,
  PLUTO_COMPONENT_ATTRIBUTE,
  PLUTO_COMPONENT_PROPS_ATTRIBUTE,
  writeEmptyComponent,
} from '#layers/pluto/shared/markdown/component'
import PlutoBlockChip from '../components/Pluto/Block/PlutoBlockChip.vue'
import { requestPlutoContentComponentOpen } from '../composables/pluto-content-components'
import { plutoAtomNodeView } from './pluto-atom-node-view'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    plutoComponent: {
      /** Inserts an empty component at the cursor; its chip opens the props form. */
      insertPlutoComponent: (name: string) => ReturnType
    }
  }
}

/**
 * The Tiptap node of a content component: `::name{props}` then `::` in the Markdown (see
 * shared/markdown/component.ts). An atom block that the editor shows as a chip
 * (`PlutoBlockChip`); a click opens the props form. The Markdown keeps the source text of an
 * unchanged prop (`braces`) and the colons. The post editors of core and of the layers
 * (supabase-blog) add it to their extensions. See the content-components skill.
 */
export const PlutoContentComponentNode: Node = Node.create({
  name: 'plutoComponent',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      name: { default: '', rendered: false },
      props: { default: {}, rendered: false },
      braces: { default: undefined, rendered: false },
      colons: { default: 2, rendered: false },
    }
  },

  parseHTML() {
    return [
      {
        tag: `div[${PLUTO_COMPONENT_ATTRIBUTE}]`,
        getAttrs: (element) => {
          const name = element.getAttribute(PLUTO_COMPONENT_ATTRIBUTE)
          if (!name) {
            return false
          }
          let props: Record<string, PlutoPropValue> = {}
          try {
            const parsed: unknown = JSON.parse(
              element.getAttribute(PLUTO_COMPONENT_PROPS_ATTRIBUTE) ?? '{}'
            )
            if (
              parsed &&
              typeof parsed === 'object' &&
              !Array.isArray(parsed)
            ) {
              props = parsed as Record<string, PlutoPropValue>
            }
          } catch {
            props = {}
          }
          return { name, props }
        },
      },
    ]
  },

  renderHTML({ node }) {
    return [
      'div',
      {
        [PLUTO_COMPONENT_ATTRIBUTE]: node.attrs.name,
        [PLUTO_COMPONENT_PROPS_ATTRIBUTE]: JSON.stringify(
          node.attrs.props ?? {}
        ),
      },
    ]
  },

  markdownTokenName: 'plutoComponent',
  markdownTokenizer: {
    name: 'plutoComponent',
    level: 'block',
    start: (src: string) => componentStart(src),
    tokenize(src: string) {
      // Every prop the author wrote: the site filters them when it renders.
      const match = matchEmptyComponent(src, { safe: false })
      if (!match) {
        return undefined
      }
      return {
        type: 'plutoComponent',
        raw: match.raw,
        name: match.name,
        props: match.props,
        braces: match.braces,
        colons: match.colons,
      }
    },
  },

  parseMarkdown(token) {
    return {
      type: 'plutoComponent',
      attrs: {
        name: token.name,
        props: token.props ?? {},
        braces: token.braces,
        colons: token.colons ?? 2,
      },
    }
  },

  renderMarkdown(node) {
    return writeEmptyComponent(
      String(node.attrs?.name ?? ''),
      (node.attrs?.props ?? {}) as Record<string, PlutoPropValue>,
      { braces: node.attrs?.braces, colons: node.attrs?.colons }
    )
  },

  addNodeView(): NodeViewRenderer {
    return plutoAtomNodeView(PlutoBlockChip)
  },

  addCommands() {
    return {
      insertPlutoComponent:
        (name) =>
        ({ commands }) => {
          requestPlutoContentComponentOpen()
          return commands.insertContent({
            type: this.name,
            attrs: { name, props: {} },
          })
        },
    }
  },
})
