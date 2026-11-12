import Link from '@tiptap/extension-link'
import {
  matchBlankLink,
  PLUTO_LINK_BLANK,
} from '#layers/pluto/shared/markdown/link-target'

/**
 * The link of the Visual editor, in place of the one of the starter kit. A link that opens in a
 * new tab (`target: '_blank'`, the box of the link popover) reads and writes the MDC attribute
 * `[text](url){target="_blank"}` (see shared/markdown/link-target.ts). A new link has no target:
 * the link of the starter kit gives every link `target="_blank"`, which the Markdown cannot hold.
 * Any other target of a pasted link does not stay.
 */
export const PlutoLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      target: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('target') === '_blank' ? '_blank' : null,
      },
      rel: {
        default: null,
        parseHTML: () => null,
      },
    }
  },

  markdownTokenizer: {
    name: 'plutoBlankLink',
    level: 'inline',
    start: (src: string) => src.indexOf('['),
    tokenize(src, _tokens, lexer) {
      const match = matchBlankLink(src)
      if (!match) {
        return undefined
      }
      const tokens = lexer.inlineTokens(match.link)
      const link = tokens[0]
      if (tokens.length !== 1 || link?.type !== 'link') {
        return undefined
      }
      return { ...link, raw: match.raw, target: '_blank' }
    },
  },

  parseMarkdown: (token, helpers) =>
    helpers.applyMark('link', helpers.parseInline(token.tokens ?? []), {
      href: token.href,
      title: token.title || null,
      target: token.target === '_blank' ? '_blank' : null,
    }),

  renderMarkdown(node, helpers, context) {
    const markdown = this.parent?.(node, helpers, context) ?? ''
    return node.attrs?.target === '_blank'
      ? `${markdown}${PLUTO_LINK_BLANK}`
      : markdown
  },
}).configure({
  openOnClick: false,
  HTMLAttributes: {
    target: null,
    rel: null,
  },
})
