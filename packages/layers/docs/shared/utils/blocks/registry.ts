// Join the presets, the component layer, the site overrides (`plutoBlocks` in
// app.config.ts) and the props found in the document into one definition for
// each component. Pure functions: the caller reads the app config and passes
// the sources in.

import type {
  PlutoBlock,
  PlutoBlockDefinition,
  PlutoBlockOverride,
  PlutoBlockPatch,
  PlutoBlockPropDefinition,
  PlutoBlocksConfig,
  PlutoBlockSlotDefinition,
  PlutoBlockSources,
  PlutoComponentBlock,
} from './types'
import { BLOCK_GROUPS, BLOCK_PRESETS, HIDDEN_PROP_NAMES } from './presets'

// The typed identity helper is in its own file, so a component file that auto-imports it does not load the registry.
export { definePlutoBlock } from './define'

export interface ResolveOptions {
  /** The layers: the component layer and the `plutoBlocks` value of the app config. */
  sources?: PlutoBlockSources
  /** A block of the doc. Its props and slots fill what the definition does not list. */
  block?: PlutoComponentBlock
}

/** A readable name from a component name: `pluto-hero` gives `Pluto hero`, `starCount` gives `Star count`. */
export function humanizeName(name: string): string {
  const text = name
    .replace(/^u-/, '')
    .replace(
      /([a-z0-9])([A-Z])/g,
      (_, before: string, letter: string) => `${before} ${letter.toLowerCase()}`
    )
    .replace(/[-_]+/g, ' ')
    .trim()
  return text ? text[0]!.toUpperCase() + text.slice(1) : name
}

/**
 * The key of a component in the sources: the kebab name that `pascalCase` turns back into the
 * component name. `PlutoHero` gives `pluto-hero`, and `UPageCTA` gives `u-page-c-t-a`. A name that
 * is already kebab case stays as it is.
 */
export function blockKey(name: string): string {
  return name.replace(/(?<!^|-)[A-Z]/g, (letter) => `-${letter}`).toLowerCase()
}

/** `star-count` gives `starCount`. */
export function camelKey(name: string): string {
  return name.replace(/-+([a-z0-9])/gi, (_, letter: string) =>
    letter.toUpperCase()
  )
}

/** The key of `map` that means `key`: the same key, else the same name in kebab or camel case. */
function sameKey(map: object, key: string): string {
  if (key in map) {
    return key
  }
  const camel = camelKey(key)
  return Object.keys(map).find((other) => camelKey(other) === camel) ?? key
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

/** The layer of one block in a config. The key can be the kebab name or any form of it. */
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

/**
 * Join the entries of one map (props or slots) one by one. An entry of the patch changes the
 * entry of the base key by key, and `false` removes it. An entry with no base starts from `fill`.
 */
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

/** The same join for two patches: `false` stays in the result, so a layer above can still remove. */
function mergePatchEntries<T extends object>(
  base: Record<string, Partial<T> | false | undefined> | undefined,
  patch: Record<string, Partial<T> | false | undefined> | undefined
): Record<string, Partial<T> | false | undefined> {
  const out = { ...base }
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (value === undefined) {
      continue
    }
    const target = sameKey(out, key)
    const current = out[target]
    out[target] =
      value === false || current === undefined || current === false
        ? value
        : { ...current, ...value }
  }
  return out
}

/**
 * Put a layer over a definition. The fields of the layer replace the fields of the base. Props and
 * slots join key by key (shallow). `false` removes a prop or a slot. `false` for the whole block
 * hides it.
 */
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

/**
 * Put one patch over another, for example the in-file macro over the block made from the
 * component meta. The result is still a patch: `false` for a prop or a slot stays in it.
 */
export function mergeBlockPatch(
  base: PlutoBlockPatch,
  over: PlutoBlockPatch | false | undefined
): PlutoBlockPatch {
  if (over === undefined) {
    return base
  }
  if (over === false) {
    return { ...base, hidden: true }
  }
  const props = mergePatchEntries(base.props, over.props)
  const slots = mergePatchEntries(base.slots, over.slots)
  return {
    ...base,
    ...over,
    ...(Object.keys(props).length ? { props } : {}),
    ...(Object.keys(slots).length ? { slots } : {}),
  } as PlutoBlockPatch
}

/** The slot content kind for a slot that no definition lists. */
function slotFromChildren(children: PlutoBlock[]): PlutoBlockSlotDefinition {
  const onlyText = children.every((child) => child.kind === 'text')
  return { content: onlyText ? 'rich' : 'blocks' }
}

/**
 * The definition of a component: the preset (or an automatic one), the
 * component layer over it, the site override over that, and the props and
 * slots of `options.block` that none of them lists. Found props go to the
 * Advanced section.
 *
 * The name can be kebab case (`pluto-hero`) or the Pascal form that a page
 * can use (`PlutoHero`). The definition has the kebab name. A prop of the
 * definition takes the spelling that the block uses: when the page has
 * `star-count` and the meta has `starCount`, the key is `star-count`, so an
 * edit changes the prop of the page and adds no second one.
 */
export function resolveBlockDefinition(
  name: string,
  options: ResolveOptions = {}
): PlutoBlockDefinition {
  const key = blockKey(name)
  const { components, overrides } = options.sources ?? {}
  const merged = mergeDefinition(
    mergeDefinition(
      BLOCK_PRESETS[key] ?? automaticDefinition(key),
      layerFor(components, key)
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

/** The text a palette inserts for a component. */
export function insertTextFor(definition: PlutoBlockDefinition): string {
  return definition.insert ?? `::${definition.name}\n::`
}

export interface PaletteGroup {
  group: string
  items: PlutoBlockDefinition[]
}

/**
 * The blocks of the palette, in groups. The presets come first, then the
 * components of the component layer (a component shows only when it is in
 * that layer), then the components that only the site config declares. A
 * hidden block, or a block set to `false`, is not in the list.
 */
export function listPaletteBlocks(
  sources: PlutoBlockSources = {}
): PaletteGroup[] {
  const names = new Set([
    ...Object.keys(BLOCK_PRESETS),
    ...Object.keys(sources.components ?? {}).map(blockKey),
    ...Object.keys(sources.overrides ?? {}).map(blockKey),
  ])
  const groups = new Map<string, PlutoBlockDefinition[]>()
  for (const name of names) {
    const definition = resolveBlockDefinition(name, { sources })
    if (definition.hidden) {
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
