import type {
  PlutoBlockPatch,
  PlutoBlockPropDefinition,
  PlutoBlockPropPatch,
  PlutoBlockSlotDefinition,
} from './definition'
import { BLOCK_COLORS, blockKey, mergeBlockPatch } from './definition'

export interface PlutoMetaSchema {
  kind?: string
  type?: string
  /** For `enum`: the members as text, by index. For `object`: the properties by name. */
  schema?: Record<string, unknown> | string
}

export interface PlutoMetaProp {
  name: string
  /** The type as text, for example `"slow" | "fast" | undefined`. */
  type: string
  schema?: PlutoMetaSchema | string
  /** The default as source text: `300`, `"normal"`, `false`. */
  default?: string
  /** The JSDoc text of the prop. */
  description?: string
  required?: boolean
}

export interface PlutoMetaSlot {
  name: string
  type?: string
  schema?: PlutoMetaSchema | string
  description?: string
}

export interface PlutoComponentMeta {
  props?: PlutoMetaProp[]
  slots?: PlutoMetaSlot[]
}

export function componentBlockName(pascalName: string): string {
  return blockKey(pascalName)
}

function splitUnion(type: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quote = ''
  let current = ''
  for (const char of type) {
    if (quote) {
      if (char === quote) {
        quote = ''
      }
    } else if (char === '"' || char === "'" || char === '`') {
      quote = char
    } else if ('{[(<'.includes(char)) {
      depth++
    } else if ('}])>'.includes(char)) {
      depth--
    } else if (char === '|' && depth === 0) {
      parts.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  parts.push(current.trim())
  return parts.filter(Boolean)
}

function typeMembers(prop: PlutoMetaProp): string[] {
  const schema = prop.schema
  const members =
    typeof schema === 'object' &&
    schema.kind === 'enum' &&
    typeof schema.schema === 'object'
      ? Object.values(schema.schema).map(String)
      : splitUnion(prop.type)
  return members.filter((member) => member !== 'undefined' && member !== 'null')
}

const STRING_LITERAL = /^(["'`])(.*)\1$/

function stringLiteral(member: string): string | undefined {
  return STRING_LITERAL.exec(member)?.[2]
}

function isIconName(name: string): boolean {
  return name === 'icon' || name.endsWith('Icon')
}

function widgetFor(
  name: string,
  members: string[]
): Pick<PlutoBlockPropDefinition, 'type' | 'options'> | undefined {
  if (members.length === 0) {
    return undefined
  }
  const literals = members.map(stringLiteral)
  if (literals.every((value) => value !== undefined)) {
    const options = (literals as string[]).map((value) => ({ value }))
    return (literals as string[]).every((value) => BLOCK_COLORS.includes(value))
      ? { type: 'color', options }
      : { type: 'select', options }
  }
  const kinds = new Set(
    members.map((member) => stringLiteral(member) ?? member)
  )
  const isBoolean = members.every((member) =>
    ['boolean', 'true', 'false'].includes(member)
  )
  if (isBoolean) {
    return { type: 'boolean' }
  }
  if (members.length === 1 && members[0] === 'number') {
    return { type: 'number' }
  }
  const textLike = members.every(
    (member) =>
      stringLiteral(member) !== undefined ||
      member === 'string' ||
      member === 'number'
  )
  if (textLike && members.includes('string')) {
    return {
      type: isIconName(name) ? 'icon' : linkName(name) ? 'link' : 'string',
    }
  }
  if (
    linkName(name) &&
    (kinds.has('string') || kinds.has('RouteLocationRaw'))
  ) {
    return { type: 'link' }
  }
  return undefined
}

function linkName(name: string): boolean {
  return name === 'to' || name === 'href'
}

export function parseDefault(
  source: string | undefined
): string | number | boolean | undefined {
  if (source === undefined) {
    return undefined
  }
  const text = source.trim()
  if (text === 'true') {
    return true
  }
  if (text === 'false') {
    return false
  }
  if (/^-?\d+(?:\.\d+)?$/.test(text)) {
    return Number(text)
  }
  const literal = STRING_LITERAL.exec(text)
  return literal && !literal[2]!.includes(literal[1]!) ? literal[2] : undefined
}

function propFromMeta(prop: PlutoMetaProp): PlutoBlockPropPatch | undefined {
  const widget = widgetFor(prop.name, typeMembers(prop))
  if (!widget) {
    return undefined
  }
  const fallback = parseDefault(prop.default)
  return {
    ...widget,
    ...(prop.description ? { description: prop.description.trim() } : {}),
    ...(fallback !== undefined ? { default: fallback } : {}),
  }
}

function hasUnwrap(slot: PlutoMetaSlot): boolean {
  const schema = slot.schema
  return (
    (typeof schema === 'object' &&
      typeof schema.schema === 'object' &&
      'mdcUnwrap' in schema.schema) ||
    /\bmdcUnwrap\b/.test(slot.type ?? '')
  )
}

function slotFromMeta(slot: PlutoMetaSlot): PlutoBlockSlotDefinition {
  return {
    ...(hasUnwrap(slot) ? { content: 'inline' as const } : {}),
  }
}

export function blockFromComponentMeta(
  name: string,
  meta: PlutoComponentMeta,
  macro?: PlutoBlockPatch | false
): { name: string; definition: PlutoBlockPatch } {
  const props: Record<string, PlutoBlockPropPatch> = {}
  for (const prop of meta.props ?? []) {
    const definition = propFromMeta(prop)
    if (definition) {
      props[prop.name] = definition
    }
  }
  const slots: Record<string, PlutoBlockSlotDefinition> = {}
  for (const slot of meta.slots ?? []) {
    slots[slot.name] = slotFromMeta(slot)
  }
  const fromMeta: PlutoBlockPatch = {
    ...(Object.keys(props).length ? { props } : {}),
    ...(Object.keys(slots).length ? { slots } : {}),
  }
  return {
    name: componentBlockName(name),
    definition: mergeBlockPatch(fromMeta, macro),
  }
}
