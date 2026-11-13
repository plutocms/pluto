import type { PlutoPropValue } from '../utils/blocks/definition'
import {
  completeOrder,
  parseInlineProps,
  renderInlineProps,
} from '../utils/blocks/mdc-props'
import { decodeEntitiesOnce, isSafeUrl } from './url-safety'

export const PLUTO_COMPONENT_ATTRIBUTE = 'data-pluto-component'

export const PLUTO_COMPONENT_PROPS_ATTRIBUTE = 'data-pluto-props'

const COMPONENT_NAME = /^[a-z][\w-]*$/i

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

const EMPTY_COMPONENT =
  /^ {0,3}(:{2,})([a-z][\w-]*)(?:\{([^}\n]*)\})?[ \t]*\n(?:[ \t]*\n)*[ \t]{0,3}\1[ \t]*(?:\n|$)/i

const COMPONENT_START = /^ {0,3}:{2,}[a-z]/im

export interface PlutoComponentMatch {
  raw: string
  name: string
  props: Record<string, PlutoPropValue>
  braces?: string
  colons: number
}

function isComponentName(name: string): boolean {
  return COMPONENT_NAME.test(name)
}

/** No name starts with `on`: Vue binds `onClick` as a listener, and a prop that falls through to an element (`onclick`) is a handler. */
export function isSafePropName(name: string): boolean {
  return (
    /^[a-z][\w-]*$/i.test(name) &&
    !/^on/i.test(name) &&
    !BLOCKED_PROPS.has(name.toLowerCase())
  )
}

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

/** Keeps the props with a safe name and a safe value. A string with a script URL goes, also inside a list or an object. */
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

export function componentMarkerHtml(
  name: string,
  props: Record<string, PlutoPropValue>
): string {
  return `<div ${PLUTO_COMPONENT_ATTRIBUTE}="${escapeAttribute(name)}" ${PLUTO_COMPONENT_PROPS_ATTRIBUTE}="${escapeAttribute(JSON.stringify(safeComponentProps(props)))}"></div>\n`
}

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
