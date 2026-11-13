import type { ElementNode } from 'ultrahtml'
import { ELEMENT_NODE, parse, renderSync, walkSync } from 'ultrahtml'
import {
  PLUTO_COMPONENT_ATTRIBUTE,
  PLUTO_COMPONENT_PROPS_ATTRIBUTE,
  readComponentMarker,
} from './component'
import { PLUTO_LINK_BLANK_REL } from './link-target'
import { decodeEntitiesOnce, isSafeUrl } from './url-safety'

export { decodeEntitiesOnce, isSafeUrl } from './url-safety'

// This file is the trust boundary for `PlutoHtml`: everything it lets through ends up in a `v-html`
// on a public page. Keep it an allowlist, never a denylist. Do not use
// `ultrahtml/transformers/sanitize`: it is a denylist and does not check URL schemes.

const ALLOWED_ELEMENTS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'strong',
  'b',
  'em',
  'i',
  's',
  'del',
  'u',
  'code',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
  'hr',
  'br',
  'a',
  'img',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'input',
])

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
  'select',
  'textarea',
  'audio',
  'video',
  'source',
  'track',
  'canvas',
  'applet',
  'frame',
  'frameset',
  'portal',
])

const LANGUAGE_CLASS = /^language-[\w+#.-]+$/
const TH_TD_ALIGN = new Set(['left', 'center', 'right'])

// ultrahtml's `renderSync` writes attribute values with no escaping. Escape every kept value, or
// `alt='x" onerror="alert(1)'` injects a live attribute. The raw value can hold entities already
// (marked writes `&amp;` in a URL): decode once, then escape once.
function keptValue(value: string): string {
  return escapeAttributeValue(decodeEntitiesOnce(value))
}

function escapeAttributeValue(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

function dropNode(node: ElementNode): void {
  const parent = node.parent
  if (parent && Array.isArray(parent.children)) {
    parent.children = parent.children.filter((child) => child !== node)
  }
}

function unwrapNode(node: ElementNode): void {
  const parent = node.parent
  if (parent && Array.isArray(parent.children)) {
    for (const child of node.children) {
      child.parent = parent
    }
    parent.children = parent.children.flatMap((child) =>
      child === node ? node.children : [child]
    )
  }
}

function filterAttributes(element: ElementNode, name: string): void {
  const attributes = element.attributes ?? {}
  const kept: Record<string, string> = {}

  switch (name) {
    case 'a': {
      if (typeof attributes.href === 'string' && isSafeUrl(attributes.href)) {
        kept.href = keptValue(attributes.href)
      }
      if (typeof attributes.title === 'string') {
        kept.title = keptValue(attributes.title)
      }
      if (attributes.target === '_blank') {
        kept.target = '_blank'
        kept.rel = PLUTO_LINK_BLANK_REL
      }
      break
    }
    case 'img': {
      if (typeof attributes.src === 'string' && isSafeUrl(attributes.src)) {
        kept.src = keptValue(attributes.src)
      }
      for (const key of ['alt', 'title', 'width', 'height']) {
        if (typeof attributes[key] === 'string') {
          kept[key] = keptValue(attributes[key])
        }
      }
      break
    }
    case 'code': {
      if (
        typeof attributes.class === 'string' &&
        LANGUAGE_CLASS.test(attributes.class)
      ) {
        kept.class = attributes.class
      }
      break
    }
    case 'input': {
      if (attributes.type === 'checkbox') {
        kept.type = 'checkbox'
        // Keep only the presence of a boolean attribute, not its value.
        if ('checked' in attributes) {
          kept.checked = ''
        }
        if ('disabled' in attributes) {
          kept.disabled = ''
        }
      }
      break
    }
    case 'p': {
      if ('data-pluto-embed' in attributes) {
        kept['data-pluto-embed'] = ''
      }
      break
    }
    case 'th':
    case 'td': {
      const align = attributes.align?.toLowerCase()
      if (align && TH_TD_ALIGN.has(align)) {
        kept.align = align
      }
      break
    }
    default:
      // No attributes: this drops every `on*` handler and every `style` attribute.
      break
  }

  element.attributes = kept
}

/** Sanitizes HTML down to a strict allowlist of elements and attributes. */
export function sanitizeHtml(html: string): string {
  const doc = parse(html)
  // Collect the actions, then apply them in reverse: a change of the tree during `walkSync` skips nodes.
  const actions: Array<() => void> = []

  walkSync(doc, (node) => {
    if (node.type !== ELEMENT_NODE) {
      return
    }

    const element = node as ElementNode
    const name = element.name.toLowerCase()

    if (DROP_ELEMENTS.has(name)) {
      actions.push(() => dropNode(element))
      return
    }

    if (name === 'div') {
      const marker = readComponentMarker(element.attributes)
      if (marker) {
        actions.push(() => {
          element.name = 'div'
          element.attributes = {
            [PLUTO_COMPONENT_ATTRIBUTE]: escapeAttributeValue(marker.name),
            [PLUTO_COMPONENT_PROPS_ATTRIBUTE]: escapeAttributeValue(
              JSON.stringify(marker.props)
            ),
          }
          element.children = []
        })
        return
      }
    }

    if (!ALLOWED_ELEMENTS.has(name)) {
      actions.push(() => unwrapNode(element))
      return
    }

    actions.push(() => {
      element.name = name
      filterAttributes(element, name)
    })
  })

  for (let i = actions.length - 1; i >= 0; i -= 1) {
    actions[i]?.()
  }

  return renderSync(doc)
}
