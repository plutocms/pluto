import type {
  PlutoBlock,
  PlutoBlockDefinition,
  PlutoBlockOverride,
  PlutoBlockPropDefinition,
  PlutoBlocksConfig,
  PlutoBlockSlotDefinition,
  PlutoBlockSources,
  PlutoComponentBlock,
} from './types'
import {
  blockKey,
  camelKey,
  humanizeName,
  mergeBlockPatch,
  sameKey,
} from './definition'
import { BLOCK_GROUPS, HIDDEN_PROP_NAMES } from './labels'

export { blockKey, camelKey, humanizeName, mergeBlockPatch }

export interface ResolveOptions {
  sources?: PlutoBlockSources
  block?: PlutoComponentBlock
}

function automaticDefinition(name: string): PlutoBlockDefinition {
  return {
    name,
    label: humanizeName(name),
    icon: 'i-lucide-puzzle',
    group: 'site',
    slots: { default: { content: 'blocks' } },
  }
}

function propFromValue(value: unknown): PlutoBlockPropDefinition {
  if (typeof value === 'boolean') {
    return { type: 'boolean', advanced: true }
  }
  if (typeof value === 'number') {
    return { type: 'number', advanced: true }
  }
  const text = typeof value === 'string' ? value : ''
  return {
    type: typeof value === 'string' && !text.includes('\n') ? 'string' : 'text',
    advanced: true,
  }
}

const NO_PRESETS: Record<string, PlutoBlockDefinition> = {}
const PROP_PREFIX = 'pluto.blocks.props.'
const SLOT_PREFIX = 'pluto.blocks.slots.'

interface SharedLabels {
  props: Set<string>
  slots: Set<string>
}

const sharedLabelsCache = new WeakMap<object, SharedLabels>()

function sharedKeys(
  presets: Record<string, PlutoBlockDefinition>,
  pick: (block: PlutoBlockDefinition) => Array<string | undefined>,
  prefix: string
): Set<string> {
  const names = new Set<string>()
  for (const preset of Object.values(presets)) {
    for (const label of pick(preset)) {
      if (label?.startsWith(prefix)) {
        names.add(label.slice(prefix.length))
      }
    }
  }
  return names
}

function sharedLabels(presets: Record<string, PlutoBlockDefinition>) {
  let labels = sharedLabelsCache.get(presets)
  if (!labels) {
    labels = {
      props: sharedKeys(
        presets,
        (preset) => Object.values(preset.props ?? {}).map((prop) => prop.label),
        PROP_PREFIX
      ),
      slots: sharedKeys(
        presets,
        (preset) => Object.values(preset.slots ?? {}).map((slot) => slot.label),
        SLOT_PREFIX
      ),
    }
    sharedLabelsCache.set(presets, labels)
  }
  return labels
}

function withSharedLabels(
  layer: PlutoBlockOverride | undefined,
  presets: Record<string, PlutoBlockDefinition>
): PlutoBlockOverride | undefined {
  if (!layer) {
    return layer
  }
  const shared = sharedLabels(presets)
  const props = Object.fromEntries(
    Object.entries(layer.props ?? {}).map(([name, prop]) => {
      const label =
        prop && !prop.label && shared.props.has(name)
          ? `${PROP_PREFIX}${name}`
          : undefined
      return [name, label && prop ? { ...prop, label } : prop]
    })
  )
  const slots = Object.fromEntries(
    Object.entries(layer.slots ?? {}).map(([name, slot]) => {
      const label =
        slot && !slot.label && shared.slots.has(name)
          ? `${SLOT_PREFIX}${name}`
          : undefined
      return [name, label && slot ? { ...slot, label } : slot]
    })
  )
  return {
    ...layer,
    ...(layer.props ? { props } : {}),
    ...(layer.slots ? { slots } : {}),
  }
}

function layerFor(
  config: PlutoBlocksConfig | undefined,
  key: string
): PlutoBlockOverride | undefined {
  if (!config) {
    return undefined
  }
  if (key in config) {
    return config[key]
  }
  const other = Object.keys(config).find((name) => blockKey(name) === key)
  return other === undefined ? undefined : config[other]
}

function mergeEntries<T extends object>(
  base: Record<string, T> | undefined,
  patch: Record<string, Partial<T> | false | undefined> | undefined,
  fill: Partial<T>
): Record<string, T> {
  const out = { ...base }
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (value === undefined) {
      continue
    }
    const target = sameKey(out, key)
    if (value === false) {
      delete out[target]
    } else {
      out[target] = { ...fill, ...out[target], ...value } as T
    }
  }
  return out
}

function mergeDefinition(
  base: PlutoBlockDefinition,
  layer: PlutoBlockOverride | undefined
): PlutoBlockDefinition {
  if (layer === false) {
    return { ...base, hidden: true }
  }
  if (typeof layer !== 'object' || layer === null) {
    return base
  }
  return {
    ...base,
    ...layer,
    name: base.name,
    props: mergeEntries(base.props, layer.props, { type: 'string' }),
    slots: mergeEntries(base.slots, layer.slots, {}),
  }
}

function slotFromChildren(children: PlutoBlock[]): PlutoBlockSlotDefinition {
  const onlyText = children.every((child) => child.kind === 'text')
  return { content: onlyText ? 'rich' : 'blocks' }
}

export function resolveBlockDefinition(
  name: string,
  options: ResolveOptions = {}
): PlutoBlockDefinition {
  const key = blockKey(name)
  const { components, overrides, presets = NO_PRESETS } = options.sources ?? {}
  const merged = mergeDefinition(
    mergeDefinition(
      presets[key] ?? automaticDefinition(key),
      withSharedLabels(layerFor(components, key), presets)
    ),
    layerFor(overrides, key)
  )
  const found = options.block?.kind === 'component' ? options.block : undefined
  if (!found) {
    return merged
  }
  const props: Record<string, PlutoBlockPropDefinition> = {}
  for (const [prop, definition] of Object.entries(merged.props ?? {})) {
    props[sameKey(found.props, prop)] = definition
  }
  for (const [prop, value] of Object.entries(found.props)) {
    if (
      !(prop in props) &&
      !(HIDDEN_PROP_NAMES as readonly string[]).includes(prop)
    ) {
      props[prop] = propFromValue(value)
    }
  }
  const slots = { ...merged.slots }
  for (const [slot, children] of Object.entries(found.slots)) {
    if (!(slot in slots)) {
      slots[slot] = slotFromChildren(children)
    }
  }
  return { ...merged, props, slots }
}

export function insertTextFor(definition: PlutoBlockDefinition): string {
  return definition.insert ?? `::${definition.name}\n::`
}

export interface PaletteGroup {
  group: string
  items: PlutoBlockDefinition[]
}

export function listPaletteBlocks(
  sources: PlutoBlockSources = {},
  accepts?: string[]
): PaletteGroup[] {
  const names = new Set([
    ...Object.keys(sources.presets ?? {}),
    ...Object.keys(sources.components ?? {}).map(blockKey),
    ...Object.keys(sources.overrides ?? {}).map(blockKey),
  ])
  const groups = new Map<string, PlutoBlockDefinition[]>()
  for (const name of names) {
    const definition = resolveBlockDefinition(name, { sources })
    if (definition.hidden && !accepts?.includes(definition.name)) {
      continue
    }
    groups.set(definition.group, [
      ...(groups.get(definition.group) ?? []),
      definition,
    ])
  }
  const known = BLOCK_GROUPS as readonly string[]
  const order = [
    ...known.filter((group) => groups.has(group)),
    ...[...groups.keys()].filter((group) => !known.includes(group)),
  ]
  return order.map((group) => ({ group, items: groups.get(group)! }))
}
