import type { ElementNode } from 'ultrahtml'
import { ELEMENT_NODE, parse, renderSync, walkSync } from 'ultrahtml'
import {
  PLUTO_COMPONENT_ATTRIBUTE,
  PLUTO_COMPONENT_PROPS_ATTRIBUTE,
  readComponentMarker,
} from './component'
import { decodeEntitiesOnce, isSafeUrl } from './url-safety'

export { decodeEntitiesOnce, isSafeUrl } from './url-safety'

// This file is the trust boundary for `PlutoMarkdown`. Everything it lets
// through ends up in a `v-html` on a public page. Keep it an allowlist,
// never a denylist — a denylist misses the next new tag or handler.
//
// `ultrahtml/transformers/sanitize` is NOT used here. It is a denylist (it
// leaves `onclick`/`onerror` alone, and does not check URL schemes at
// all), so it does not fit this job.

// Elements this sanitizer keeps. Every other element is either unwrapped
// (children kept, tag dropped) or hard-dropped (see DROP_ELEMENTS below).
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

// Hard-dropped: the element AND every child node is removed. A `<script>`
// body is a text-node child of the `<script>` element, so dropping the
// element removes the code with it.
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

// ultrahtml's `renderSync` writes attribute values into `key="value"` with
// no escaping of its own (see its `attrs()` helper). Every attribute value
// this sanitizer keeps must be escaped here, or a value such as
// `alt='x" onerror="alert(1)'` breaks out of the quote and injects a new,
// live attribute in the final HTML.
/**
 * The value to write for a kept attribute. ultrahtml gives the raw value, which can hold entities
 * already (marked writes `&amp;` in a URL). Decode it once, as a browser reads it, then escape it
 * once, so `?a=1&amp;b=2` stays `?a=1&amp;b=2` and does not become `&amp;amp;`.
 */
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
        // Boolean attributes: carry only their presence, not any value an
        // attacker may have attached to them.
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
      // The mark of a paragraph that can be an embed (see `isEmbedParagraph` in render.ts).
      // Only its presence counts: the value is always empty.
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
      // Every other allowed element keeps no attributes. This alone drops
      // every `on*` event handler and every `style` attribute.
      break
  }

  element.attributes = kept
}

/**
 * Sanitize HTML down to a strict allowlist of elements and attributes.
 *
 * This is the only function in this file other code should call. It parses
 * `html`, walks the resulting tree once to collect an action per node
 * (drop, unwrap, or filter its attributes), then applies those actions in
 * reverse order — mutating the tree while `walkSync` is still walking it
 * would skip or duplicate nodes.
 */
export function sanitizeHtml(html: string): string {
  const doc = parse(html)
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

    // The mark of a content component (see shared/markdown/component.ts): a `div` with a valid
    // name keeps the name and the props (parsed, filtered and written again), and nothing else.
    // It has no children: the site renders the component there.
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
