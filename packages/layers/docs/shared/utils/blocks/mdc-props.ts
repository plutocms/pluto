// Read and write the props of an MDC component: the inline form `{a="b" .c}`
// and the YAML block. A prop that did not change keeps its source text, so a
// small edit does not rewrite the other props.

import type { PlutoPropValue } from './types'
import { parseDocument, stringify } from 'yaml'

export interface PropSource {
  value: PlutoPropValue
  text: string
}

export interface ParsedProps {
  props: Record<string, PlutoPropValue>
  order: string[]
  source: Record<string, PropSource>
}

export interface ParsedOpener {
  colons: number
  name: string
  /** The text inside the braces, when the line has braces. */
  braces?: string
}

const OPENER = /^(:{2,})([a-z][\w-]*)(?:\{(.*)\})?[ \t]*$/i

/** Reads the opening line of a container component. It returns `undefined` for a line it does not know. */
export function parseOpener(line: string): ParsedOpener | undefined {
  const match = OPENER.exec(line)
  if (!match) {
    return undefined
  }
  return { colons: match[1]!.length, name: match[2]!, braces: match[3] }
}

export function isEqualValue(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true
  }
  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null
  ) {
    return false
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    return false
  }
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  return (
    keysA.length === keysB.length &&
    keysA.every(
      (key) =>
        Object.hasOwn(b, key) &&
        isEqualValue(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key]
        )
    )
  )
}

// Inline props

/** Splits the text inside the braces into tokens. A quoted value can hold spaces. */
function tokenize(body: string): string[] {
  const tokens: string[] = []
  let index = 0
  while (index < body.length) {
    if (/\s/.test(body[index]!)) {
      index++
      continue
    }
    const start = index
    let quote = ''
    while (index < body.length) {
      const char = body[index]!
      if (quote) {
        if (char === '\\' && index + 1 < body.length) {
          index++
        } else if (char === quote) {
          quote = ''
        }
      } else if (char === '"' || char === "'") {
        quote = char
      } else if (/\s/.test(char)) {
        break
      }
      index++
    }
    tokens.push(body.slice(start, index))
  }
  return tokens
}

function unquote(raw: string): { text: string; quoted: boolean } {
  const first = raw[0]
  if (
    (first === '"' || first === "'") &&
    raw.length >= 2 &&
    raw.endsWith(first)
  ) {
    return {
      text: raw.slice(1, -1).replaceAll('&quot;', '"').replaceAll('&#39;', "'"),
      quoted: true,
    }
  }
  return { text: raw, quoted: false }
}

/** Reads the text inside the braces: `center .big #id title="A b" :cols="3"`. */
export function parseInlineProps(body: string): ParsedProps {
  const result: ParsedProps = { props: {}, order: [], source: {} }
  const add = (key: string, value: PlutoPropValue, text: string) => {
    if (key in result.props) {
      // `.a` and `class="b"` both set the class: join them.
      if (
        key === 'class' &&
        typeof result.props[key] === 'string' &&
        typeof value === 'string'
      ) {
        const joined = `${result.props[key]} ${value}`
        result.props[key] = joined
        result.source[key] = {
          value: joined,
          text: `${result.source[key]!.text} ${text}`,
        }
        return
      }
      // A repeated key: the last one wins, and the text of both stays.
      result.source[key] = {
        value,
        text: `${result.source[key]!.text} ${text}`,
      }
      result.props[key] = value
      return
    }
    result.props[key] = value
    result.order.push(key)
    result.source[key] = { value, text }
  }

  for (const token of tokenize(body)) {
    if (token.startsWith('.') && token.length > 1) {
      add('class', token.slice(1), token)
    } else if (token.startsWith('#') && token.length > 1) {
      add('id', token.slice(1), token)
    } else {
      const equals = token.indexOf('=')
      if (equals === -1) {
        add(token, true, token)
        continue
      }
      const key = token.slice(0, equals)
      const { text } = unquote(token.slice(equals + 1))
      if (key.startsWith(':') && key.length > 1) {
        try {
          add(key.slice(1), JSON.parse(text), token)
          continue
        } catch {
          // Not JSON: keep the key with its colon, as plain text.
        }
      }
      add(key, text, token)
    }
  }
  return result
}

function quoteString(value: string): string {
  if (!value.includes('"')) {
    return `"${value}"`
  }
  if (!value.includes("'")) {
    return `'${value}'`
  }
  return `"${value.replaceAll('"', '&quot;')}"`
}

/** Writes one prop as an inline token. It returns `undefined` for a prop that must not show. */
export function renderInlineToken(
  key: string,
  value: PlutoPropValue
): string | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value === true) {
    return key
  }
  if (typeof value === 'string') {
    if (value.includes('\n')) {
      return `:${key}='${JSON.stringify(value).replaceAll("'", '\\u0027')}'`
    }
    return `${key}=${quoteString(value)}`
  }
  return `:${key}='${JSON.stringify(value).replaceAll("'", '\\u0027')}'`
}

/** True when `props` still has the keys, the order and the values of the source. */
export function isSameProps(
  props: Record<string, PlutoPropValue>,
  order: string[],
  source: Record<string, PropSource>
): boolean {
  const keys = order.filter((key) => props[key] !== undefined)
  const sourceKeys = Object.keys(source)
  if (
    keys.length !== sourceKeys.length ||
    Object.keys(props).filter((key) => props[key] !== undefined).length !==
      keys.length
  ) {
    return false
  }
  return keys.every(
    (key, index) =>
      sourceKeys[index] === key && isEqualValue(props[key], source[key]!.value)
  )
}

/** Writes the props as tokens, in order. An unchanged prop keeps its text. */
export function renderInlineProps(
  props: Record<string, PlutoPropValue>,
  order: string[],
  source: Record<string, PropSource>
): string {
  const tokens: string[] = []
  for (const key of order) {
    const value = props[key]
    if (value === undefined) {
      continue
    }
    const known = source[key]
    const token =
      known && isEqualValue(known.value, value)
        ? known.text
        : renderInlineToken(key, value)
    if (token) {
      tokens.push(token)
    }
  }
  return tokens.join(' ')
}

/** The order to write: the old order, then the new keys. */
export function completeOrder(
  props: Record<string, PlutoPropValue>,
  order: string[]
): string[] {
  const out = order.filter((key) => key in props)
  for (const key of Object.keys(props)) {
    if (!out.includes(key)) {
      out.push(key)
    }
  }
  return out
}

// YAML props

/** Reads the lines of a YAML block, without the `---` lines and without the indent. */
export function parseYamlProps(text: string): ParsedProps | undefined {
  const document = parseDocument(text)
  if (document.errors.length > 0) {
    return undefined
  }
  const json = document.toJSON()
  if (json === null) {
    return { props: {}, order: [], source: {} }
  }
  if (typeof json !== 'object' || Array.isArray(json)) {
    return undefined
  }
  const result: ParsedProps = { props: {}, order: [], source: {} }
  const contents = document.contents as {
    items?: Array<{
      key: { value: unknown; range?: number[] | null }
      value: { range?: number[] | null } | null
    }>
  } | null
  for (const item of contents?.items ?? []) {
    const key = String(item.key.value)
    const start = item.key.range?.[0]
    const end = item.value?.range?.[1] ?? item.key.range?.[1]
    result.props[key] = (json as Record<string, unknown>)[key]
    result.order.push(key)
    if (start !== undefined && end !== undefined) {
      result.source[key] = {
        value: result.props[key],
        text: text.slice(start, end).trimEnd(),
      }
    }
  }
  return result
}

/** Writes the YAML entries (no `---` lines), one text for each prop, without indent. */
export function renderYamlProps(
  props: Record<string, PlutoPropValue>,
  order: string[],
  source: Record<string, PropSource>
): string[] {
  const entries: string[] = []
  for (const key of order) {
    const value = props[key]
    if (value === undefined) {
      continue
    }
    const known = source[key]
    entries.push(
      known && isEqualValue(known.value, value)
        ? known.text
        : stringify({ [key]: value }, { lineWidth: 0 }).trimEnd()
    )
  }
  return entries
}
