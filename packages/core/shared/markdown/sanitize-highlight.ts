import type { ElementNode, Node } from 'ultrahtml'
import {
  COMMENT_NODE,
  ELEMENT_NODE,
  parse,
  renderSync,
  walkSync,
} from 'ultrahtml'

// The allowlist for the output of a code highlighter (lowlight, Shiki, a layer of the site): the
// HTML of one code block. It is a second trust boundary next to `sanitizeHtml`: a highlighter runs
// after the sanitizer, so what it returns is checked here before it reaches a public page. Keep it
// an allowlist. See the content-model skill ("Code highlighters").

const ALLOWED_ELEMENTS = new Set(['pre', 'code', 'span'])

// The element and its children go. Every other unknown element is unwrapped (its text stays).
const DROP_ELEMENTS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'template',
  'noscript',
  'svg',
  'math',
  'link',
  'meta',
  'base',
  'form',
  'button',
  'input',
  'select',
  'textarea',
  'img',
  'audio',
  'video',
  'canvas',
  'a',
])

const CLASS_TOKEN = /^[\w-]+$/

// The CSS of a token: its colors and its font style. A custom property is for a theme that switches
// colors with CSS (`--shiki-light`, `--shiki-dark`).
const STYLE_PROPERTIES = new Set([
  'color',
  'background-color',
  'font-style',
  'font-weight',
  'text-decoration',
  'text-decoration-line',
])
const CUSTOM_PROPERTY = /^--[\w-]+$/
// A color, a keyword, a number or `var()`: letters, digits, `#`, spaces, dots, commas, `%`,
// parentheses and dashes. No `url(`, no `expression(`, no backslash, no quote.
const STYLE_VALUE = /^[\w\s#.,%()-]+$/
const UNSAFE_VALUE = /url\(|expression\(|image-set\(|@import/i

function escapeAttributeValue(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

/** The classes that are plain names (`hljs-keyword`, `shiki`, `github-dark`). */
export function safeHighlightClass(value: string): string {
  return value
    .split(/\s+/)
    .filter((token) => CLASS_TOKEN.test(token))
    .join(' ')
}

/** The declarations of the allowlist, written again: `color:#24292e;font-style:italic`. */
export function safeHighlightStyle(value: string): string {
  const kept: string[] = []
  for (const declaration of value.split(';')) {
    const colon = declaration.indexOf(':')
    if (colon < 0) {
      continue
    }
    const property = declaration.slice(0, colon).trim().toLowerCase()
    const raw = declaration.slice(colon + 1).trim()
    if (
      !(STYLE_PROPERTIES.has(property) || CUSTOM_PROPERTY.test(property)) ||
      !raw ||
      !STYLE_VALUE.test(raw) ||
      UNSAFE_VALUE.test(raw)
    ) {
      continue
    }
    kept.push(`${property}:${raw}`)
  }
  return kept.join(';')
}

function removeFrom(parent: Node | undefined, node: Node, children: Node[]) {
  if (parent && Array.isArray(parent.children)) {
    parent.children = parent.children.flatMap((child: Node) =>
      child === node ? children : [child]
    )
    for (const child of children) {
      child.parent = parent
    }
  }
}

/**
 * The HTML of a highlighted code block, with only `pre`, `code` and `span`, the classes that are
 * plain names, the colors and the font style in `style`, and `tabindex="0"` on `pre` (Shiki makes
 * a block focusable, so a keyboard can scroll it). Comments go. The text stays as it is: a
 * highlighter escapes it, and the parser reads any `<` it left as markup, which this allowlist
 * then filters.
 */
export function sanitizeHighlightHtml(html: string): string {
  const doc = parse(html)
  const actions: Array<() => void> = []

  walkSync(doc, (node) => {
    if (node.type === COMMENT_NODE) {
      actions.push(() => removeFrom(node.parent, node, []))
      return
    }
    if (node.type !== ELEMENT_NODE) {
      return
    }
    const element = node as ElementNode
    const name = element.name.toLowerCase()
    if (DROP_ELEMENTS.has(name)) {
      actions.push(() => removeFrom(element.parent, element, []))
      return
    }
    if (!ALLOWED_ELEMENTS.has(name)) {
      actions.push(() => removeFrom(element.parent, element, element.children))
      return
    }
    actions.push(() => {
      const attributes = element.attributes ?? {}
      const kept: Record<string, string> = {}
      if (typeof attributes.class === 'string') {
        const value = safeHighlightClass(attributes.class)
        if (value) {
          kept.class = value
        }
      }
      if (typeof attributes.style === 'string') {
        const value = safeHighlightStyle(attributes.style)
        if (value) {
          kept.style = escapeAttributeValue(value)
        }
      }
      if (name === 'pre' && attributes.tabindex === '0') {
        kept.tabindex = '0'
      }
      element.name = name
      element.attributes = kept
    })
  })

  for (let i = actions.length - 1; i >= 0; i -= 1) {
    actions[i]?.()
  }
  return renderSync(doc)
}
