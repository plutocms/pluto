// Content components: a component of the site in the body of a post. The Markdown is the MDC block
// form with inline props and no content:
//
//   ::name{title="Hello" :count='3'}
//   ::
//
// The renderer turns it into a mark, `<div data-pluto-component="name" data-pluto-props="{json}">`,
// and `PlutoHtml` renders the component there. Only a component that calls `definePlutoBlock` can
// render (`#pluto-block-components`); another name renders nothing. The editors show it as a chip.
// A component with content (a slot) or a YAML props block keeps the old rule: the renderer shows its
// text (`stripMdc`). Pure: no DOM, no Nuxt. See the content-components skill.
import type { PlutoPropValue } from '../utils/blocks/definition'
import {
  completeOrder,
  parseInlineProps,
  renderInlineProps,
} from '../utils/blocks/mdc-props'
import { decodeEntitiesOnce, isSafeUrl } from './url-safety'

/** The attribute with the component name. */
export const PLUTO_COMPONENT_ATTRIBUTE = 'data-pluto-component'

/** The attribute with the props, as JSON. */
export const PLUTO_COMPONENT_PROPS_ATTRIBUTE = 'data-pluto-props'

/** A component name of MDC: `my-card`, `MyCard`. */
const COMPONENT_NAME = /^[a-z][\w-]*$/i

/** Props that never come from the Markdown: Vue internals, raw HTML, events, and `style`. */
const BLOCKED_PROPS = new Set([
  'key',
  'ref',
  'is',
  'style',
  'innerhtml',
  'textcontent',
  'innertext',
  'outerhtml',
])

/**
 * An empty component at the start of `src`: the opening line (`::name` or `::name{props}`), blank
 * lines, and the closing line with the same colons. Up to three spaces before each, as in Markdown.
 */
const EMPTY_COMPONENT =
  /^ {0,3}(:{2,})([a-z][\w-]*)(?:\{([^}\n]*)\})?[ \t]*\n(?:[ \t]*\n)*[ \t]{0,3}\1[ \t]*(?:\n|$)/i

/** The first line that can open an empty component. */
const COMPONENT_START = /^ {0,3}:{2,}[a-z]/im

export interface PlutoComponentMatch {
  /** The matched text, with the last line break. */
  raw: string
  name: string
  /** The props after the safety filter (`safeComponentProps`). */
  props: Record<string, PlutoPropValue>
  /** The text inside the braces, as written. */
  braces?: string
  /** The colons of the opening and the closing line. */
  colons: number
}

export function isComponentName(name: string): boolean {
  return COMPONENT_NAME.test(name)
}

/**
 * `true` for a prop name that can come from the Markdown. No name starts with `on`: Vue binds
 * `onClick` as a listener, and a prop that falls through to an element (`onclick`) is a handler.
 */
export function isSafePropName(name: string): boolean {
  return (
    /^[a-z][\w-]*$/i.test(name) &&
    !/^on/i.test(name) &&
    !BLOCKED_PROPS.has(name.toLowerCase())
  )
}

/** A `javascript:`, `vbscript:` or (not image) `data:` URL, with the tricks of `isSafeUrl`. */
function isScriptUrl(value: string): boolean {
  const stripped = decodeEntitiesOnce(value)
    // eslint-disable-next-line no-control-regex, regexp/no-obscure-range -- the C0 controls and the space, which a browser ignores in a scheme
    .replace(/[\u0000- ]/g, '')
    .toLowerCase()
  return /^(?:javascript|vbscript|data):/.test(stripped) && !isSafeUrl(value)
}

function safeValue(value: unknown): PlutoPropValue | undefined {
  if (typeof value === 'string') {
    return isScriptUrl(value) ? undefined : value
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }
  if (typeof value === 'boolean' || value === null) {
    return value
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => safeValue(item))
      .filter((item) => item !== undefined)
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      const kept = safeValue(item)
      if (kept !== undefined && key !== '__proto__') {
        out[key] = kept
      }
    }
    return out
  }
  return undefined
}

/**
 * The props that a page can give to a component: a safe name (`isSafePropName`), and a value that is
 * text, a number, a boolean, or a list or an object of them. A string with a script URL goes, also
 * inside a list or an object. The component gets no more than an author can write.
 */
export function safeComponentProps(
  props: Record<string, unknown>
): Record<string, PlutoPropValue> {
  const out: Record<string, PlutoPropValue> = {}
  for (const [name, value] of Object.entries(props)) {
    if (!isSafePropName(name)) {
      continue
    }
    const kept = safeValue(value)
    if (kept !== undefined) {
      out[name] = kept
    }
  }
  return out
}

/**
 * The empty component at the start of `src`, else `undefined`. The props pass the safety filter
 * (`safeComponentProps`); an editor passes `{ safe: false }` to keep every prop the author wrote.
 */
export function matchEmptyComponent(
  src: string,
  options: { safe?: boolean } = {}
): PlutoComponentMatch | undefined {
  const match = EMPTY_COMPONENT.exec(src)
  if (!match) {
    return undefined
  }
  const braces = match[3]
  const parsed = braces === undefined ? undefined : parseInlineProps(braces)
  return {
    raw: match[0],
    name: match[2]!,
    props:
      options.safe === false
        ? (parsed?.props ?? {})
        : safeComponentProps(parsed?.props ?? {}),
    ...(braces === undefined ? {} : { braces }),
    colons: match[1]!.length,
  }
}

/** The index of the first line that can open an empty component, else -1. */
export function componentStart(src: string): number {
  return src.search(COMPONENT_START)
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** The mark of a component in the HTML. Empty: the site renders the component there. */
export function componentMarkerHtml(
  name: string,
  props: Record<string, PlutoPropValue>
): string {
  return `<div ${PLUTO_COMPONENT_ATTRIBUTE}="${escapeAttribute(name)}" ${PLUTO_COMPONENT_PROPS_ATTRIBUTE}="${escapeAttribute(JSON.stringify(safeComponentProps(props)))}"></div>\n`
}

/**
 * Reads the mark from the raw attributes of a `div` (ultrahtml keeps the entities). `undefined` when
 * it is not a mark, or the name is not valid. Props that do not parse give `{}`.
 */
export function readComponentMarker(
  attributes: Record<string, string> | undefined
): { name: string; props: Record<string, PlutoPropValue> } | undefined {
  const name = attributes?.[PLUTO_COMPONENT_ATTRIBUTE]
  if (typeof name !== 'string') {
    return undefined
  }
  const decoded = decodeEntitiesOnce(name)
  if (!isComponentName(decoded)) {
    return undefined
  }
  let props: Record<string, PlutoPropValue> = {}
  const text = attributes?.[PLUTO_COMPONENT_PROPS_ATTRIBUTE]
  if (typeof text === 'string') {
    try {
      const parsed: unknown = JSON.parse(decodeEntitiesOnce(text))
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        props = safeComponentProps(parsed as Record<string, unknown>)
      }
    } catch {
      props = {}
    }
  }
  return { name: decoded, props }
}

/**
 * The Markdown of an empty component. `braces` is the source text of the props: a prop with the
 * same value keeps its text, so a small edit does not rewrite the others.
 */
export function writeEmptyComponent(
  name: string,
  props: Record<string, PlutoPropValue>,
  options: { braces?: string; colons?: number } = {}
): string {
  const source = parseInlineProps(options.braces ?? '')
  const inline = renderInlineProps(
    props,
    completeOrder(props, source.order),
    source.source
  )
  const colons = ':'.repeat(Math.max(2, options.colons ?? 2))
  return `${colons}${name}${inline ? `{${inline}}` : ''}\n${colons}`
}
