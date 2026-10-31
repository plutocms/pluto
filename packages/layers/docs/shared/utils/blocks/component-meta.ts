// Make a block definition from the meta of a Vue component and the optional
// `definePlutoBlock({...})` call in its file. Pure: the build step (a later
// change) parses the files with `nuxt-component-meta` and passes the result in.
// The result is the "component layer" of one component. Opt-in: the build step
// calls this only for a component that has the macro.

import type {
  PlutoBlockPatch,
  PlutoBlockPropDefinition,
  PlutoBlockPropPatch,
  PlutoBlockSlotDefinition,
} from './types'
import { BLOCK_COLORS, BLOCK_PRESETS } from './presets'
import { blockKey, mergeBlockPatch } from './registry'

// The parts of the output of `getComponentMeta` that this file reads. The real output has more.
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

/** The block key of a component: `PlutoHero` gives `pluto-hero`, `UPageCTA` gives `u-page-c-t-a`. */
export function componentBlockName(pascalName: string): string {
  return blockKey(pascalName)
}

// --- Type to widget ---------------------------------------------------------------

/** Split a union at its top-level bars, so a bar inside quotes or brackets stays. */
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

/** The members of the type without `undefined` and `null`. */
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

/** The widget for a prop, or `undefined` when no widget fits. */
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

/** A simple default from source text: a number, a boolean or a string. Anything else gives `undefined`. */
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

// --- Shared labels ----------------------------------------------------------------

function sharedKeys(
  pick: (block: (typeof BLOCK_PRESETS)[string]) => Array<string | undefined>,
  prefix: string
): Set<string> {
  const names = new Set<string>()
  for (const preset of Object.values(BLOCK_PRESETS)) {
    for (const label of pick(preset)) {
      if (label?.startsWith(prefix)) {
        names.add(label.slice(prefix.length))
      }
    }
  }
  return names
}

const PROP_PREFIX = 'docs.blocks.props.'
const SLOT_PREFIX = 'docs.blocks.slots.'
let sharedProps: Set<string> | undefined
let sharedSlots: Set<string> | undefined

/** The shared label key of a prop (`icon`, `to`, `title`...) when the presets have one. */
function propLabelKey(name: string): string | undefined {
  sharedProps ??= sharedKeys(
    (preset) => Object.values(preset.props ?? {}).map((prop) => prop.label),
    PROP_PREFIX
  )
  return sharedProps.has(name) ? `${PROP_PREFIX}${name}` : undefined
}

function slotLabelKey(name: string): string | undefined {
  sharedSlots ??= sharedKeys(
    (preset) => Object.values(preset.slots ?? {}).map((slot) => slot.label),
    SLOT_PREFIX
  )
  return sharedSlots.has(name) ? `${SLOT_PREFIX}${name}` : undefined
}

// --- The block --------------------------------------------------------------------

function propFromMeta(prop: PlutoMetaProp): PlutoBlockPropPatch | undefined {
  const widget = widgetFor(prop.name, typeMembers(prop))
  if (!widget) {
    return undefined
  }
  const label = propLabelKey(prop.name)
  const fallback = parseDefault(prop.default)
  return {
    ...widget,
    ...(label ? { label } : {}),
    ...(prop.description ? { description: prop.description.trim() } : {}),
    ...(fallback !== undefined ? { default: fallback } : {}),
  }
}

/** `mdc-unwrap` on a `<slot>` shows as the binding `mdcUnwrap` in the meta. */
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
  const label = slotLabelKey(slot.name)
  return {
    ...(label ? { label } : {}),
    ...(hasUnwrap(slot) ? { content: 'inline' as const } : {}),
  }
}

/**
 * The component layer of one component: the props and slots of its meta, joined with the object of
 * its `definePlutoBlock({...})` call. The macro wins, key by key (`false` removes a prop or a slot).
 * `name` is the component name in Pascal case or kebab case. The result has the block key for the
 * `PlutoBlocksConfig` of the component layer.
 *
 * Props that no widget fits (an object, an array, a function, a number literal) are left out. A
 * page that sets one still shows it in Advanced. The macro can give such a prop a widget.
 */
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
