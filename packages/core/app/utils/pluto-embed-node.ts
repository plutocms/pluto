import type { NodeViewRenderer } from '@tiptap/core'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import type { Tokens } from 'marked'
import type { PlutoEmbedProvider } from '../../shared/types/registry'
import { Extension, Node } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { isEmbedParagraph } from '#layers/pluto/shared/markdown/render'
import { resolveEmbed } from '#layers/pluto/shared/utils/embed'
import PlutoEmbedNodeView from '../components/Pluto/Embed/PlutoEmbedNodeView.vue'
import { plutoAtomNodeView } from './pluto-atom-node-view'

/**
 * Embeds in the Visual editor. On the site, a top-level paragraph that is one URL alone shows as
 * the player of the first embed provider that matches the URL (`isEmbedParagraph`, `PlutoHtml`).
 * The editor shows the same paragraph as a `plutoEmbed` block: the thumbnail of the provider
 * component, not the link.
 *
 * - Loading: `plutoEmbedParagraph` reads a URL alone on its line as a paragraph with its source text
 *   (`plutoEmbedSource`), and a pass turns each top-level one into a `plutoEmbed` block. A nested
 *   one (a list, a quote) stays a link, as on the site.
 * - Saving: the block writes its source text back, so an open post stays unchanged. A pasted URL
 *   is written alone on its line.
 * - Pasting: a URL of a provider, pasted alone into an empty top-level line, becomes the block,
 *   with an empty line after it for the text that follows.
 *
 * See the content-model skill ("Embeds").
 */
export interface PlutoEmbedOptions {
  /** The embed providers of the registry. */
  providers: () => readonly PlutoEmbedProvider[]
}

type PmNode = EditorState['doc']

const SOURCE_ATTRIBUTE = 'plutoEmbedSource'

function embedOf(providers: () => readonly PlutoEmbedProvider[], href: string) {
  return /^https?:\/\//i.test(href) ? resolveEmbed(providers(), href) : null
}

function linkOnlyHref(paragraph: PmNode): string | null {
  if (paragraph.childCount !== 1) {
    return null
  }
  const text = paragraph.firstChild!
  const link = text.marks.find((mark) => mark.type.name === 'link')
  const href = typeof link?.attrs.href === 'string' ? link.attrs.href : ''
  return text.isText && href && text.text?.trim() === href ? href : null
}

function convertEmbedParagraphs(state: EditorState): Transaction | null {
  const embed = state.schema.nodes.plutoEmbed
  if (!embed) {
    return null
  }
  const found: Array<{ pos: number; node: PmNode; href: string }> = []
  state.doc.forEach((node, pos) => {
    const source = node.attrs[SOURCE_ATTRIBUTE]
    const href =
      node.type.name === 'paragraph' && source ? linkOnlyHref(node) : null
    if (href) {
      found.push({ pos, node, href })
    }
  })
  if (found.length === 0) {
    return null
  }
  const tr = state.tr
  for (const { pos, node, href } of found.reverse()) {
    tr.replaceWith(
      pos,
      pos + node.nodeSize,
      embed.create({ url: href, source: node.attrs[SOURCE_ATTRIBUTE] })
    )
  }
  return tr.setMeta('addToHistory', false)
}

/** The block of an embed: the provider thumbnail, and the URL on its line in the Markdown. */
export const PlutoEmbedNode = Node.create({
  name: 'plutoEmbed',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      url: { default: '', rendered: false },
      source: { default: undefined, rendered: false },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-pluto-embed-url]',
        getAttrs: (element) => {
          const url = element.getAttribute('data-pluto-embed-url')
          return url ? { url } : false
        },
      },
    ]
  },

  renderHTML({ node }) {
    return ['div', { 'data-pluto-embed-url': node.attrs.url }]
  },

  renderMarkdown(node) {
    return String(node.attrs?.source || node.attrs?.url || '')
  },

  addNodeView(): NodeViewRenderer {
    return plutoAtomNodeView(PlutoEmbedNodeView)
  },
})

const URL_LINE =
  /^(?:<https?:\/\/[^\s<>]+>|https?:\/\/\S+|\[https?:\/\/[^\s\]]+\]\(https?:\/\/[^\s)]+\))[ \t]*(?:\n|$)(?=[ \t]*(?:\n|$))/

/** The parsing, the paste rule and the pass of the embed blocks. Add it with `PlutoEmbedNode`. */
export const PlutoEmbedParagraph = Extension.create<PlutoEmbedOptions>({
  name: 'plutoEmbedParagraph',

  addOptions() {
    return { providers: () => [] }
  },

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          [SOURCE_ATTRIBUTE]: {
            default: null,
            rendered: false,
            keepOnSplit: false,
          },
        },
      },
    ]
  },

  markdownTokenName: 'plutoEmbedLine',
  markdownTokenizer: {
    name: 'plutoEmbedLine',
    level: 'block',
    start: () => -1,
    tokenize(src: string) {
      const match = URL_LINE.exec(src)
      return match
        ? { type: 'plutoEmbedLine', raw: match[0], text: match[0].trim() }
        : undefined
    },
  },

  parseMarkdown(token, helpers) {
    const text = String(token.text ?? '')
    const tokens = (helpers.tokenizeInline?.(text) ?? []) as Tokens.Generic[]
    const link = tokens.find((part) => part.type === 'link') as
      Tokens.Link | undefined
    const embed =
      isEmbedParagraph(tokens) &&
      link &&
      embedOf(this.options.providers, link.href)
    return helpers.createNode(
      'paragraph',
      embed ? { [SOURCE_ATTRIBUTE]: text } : undefined,
      helpers.parseInline(tokens)
    )
  },

  onCreate() {
    const tr = convertEmbedParagraphs(this.editor.state)
    if (tr) {
      this.editor.view.dispatch(tr)
    }
  },

  addProseMirrorPlugins() {
    const providers = this.options.providers
    return [
      new Plugin({
        key: new PluginKey('plutoEmbed'),
        appendTransaction: (transactions, _old, state) =>
          transactions.some((tr) => tr.docChanged)
            ? convertEmbedParagraphs(state)
            : null,
        props: {
          handlePaste(view, event) {
            const text =
              event.clipboardData?.getData('text/plain')?.trim() ?? ''
            const { state } = view
            const { $from, empty } = state.selection
            const embed = state.schema.nodes.plutoEmbed
            const paragraph = state.schema.nodes.paragraph
            if (
              !text ||
              /\s/.test(text) ||
              !empty ||
              !embed ||
              !paragraph ||
              $from.depth !== 1 ||
              $from.parent.type !== paragraph ||
              $from.parent.content.size > 0 ||
              !embedOf(providers, text)
            ) {
              return false
            }
            const start = $from.before()
            const tr = state.tr.replaceWith(
              start,
              $from.after(),
              embed.create({ url: text })
            )
            const after = start + 1
            const next = tr.doc.nodeAt(after)
            if (!next || next.type !== paragraph || next.content.size > 0) {
              tr.insert(after, paragraph.create())
            }
            tr.setSelection(TextSelection.create(tr.doc, after + 1))
            view.dispatch(tr.scrollIntoView())
            return true
          },
        },
      }),
    ]
  },
})
