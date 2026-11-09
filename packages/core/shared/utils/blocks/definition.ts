// The block definition model: what an editor shows for a component (the props, their widgets, the
// slots), and the patch that a component file gives with `definePlutoBlock({...})`. Shared by the
// block editor of the docs layer and the content components of the post editor. Pure: no Nuxt.
// See the content-components skill.

export type PlutoPropValue = unknown

// Block definitions: what the editor shows for a component.

export type PlutoBlockPropType =
  | 'string'
  | 'text'
  | 'boolean'
  | 'number'
  | 'select'
  | 'icon'
  | 'color'
  | 'link'
  | 'media'

export interface PlutoBlockPropOption {
  value: string
  /** A plain text or an i18n key. */
  label?: string
}

export interface PlutoBlockPropDefinition {
  type: PlutoBlockPropType
  /** A plain text or an i18n key. */
  label?: string
  description?: string
  options?: Array<string | PlutoBlockPropOption>
  /** A prop in the Advanced section of the panel. */
  advanced?: boolean
  /**
   * A slot with the same text, for example the `default` slot of a button and its `label`. The
   * panel shows one field for both: it edits the slot when the block has text in it (the slot wins
   * on the site), else the prop. The slot does not show in the Content section.
   */
  slot?: string
  /**
   * The value the component uses when the prop is missing. The control shows it as the
   * placeholder (or in the "Default" item of a choice). It never goes into the Markdown.
   */
  default?: string | number | boolean
  /**
   * For a `media` prop: the other props that a choice from the media library also sets, from the
   * record of the file: `width`, `height`, and `alt` (only while that prop is empty).
   */
  fills?: { width?: string; height?: string; alt?: string }
}

/** The editor for the content of a slot. */
export type PlutoBlockSlotContent = 'rich' | 'inline' | 'blocks'

export interface PlutoBlockSlotDefinition {
  label?: string
  content?: PlutoBlockSlotContent
  /** For `blocks`: the component names that the slot accepts. */
  accepts?: string[]
}

export interface PlutoBlockDefinition {
  name: string
  /** A plain text or an i18n key. */
  label: string
  /** A plain text or an i18n key. */
  description?: string
  icon: string
  group: string
  props?: Record<string, PlutoBlockPropDefinition>
  slots?: Record<string, PlutoBlockSlotDefinition>
  /** The Markdown that the palette inserts. */
  insert?: string
  /** `false` shows a placeholder card instead of the component in the preview. */
  preview?: boolean
  /** Not in the palette. The block still shows with its label. */
  hidden?: boolean
}

/** A change to one prop: a partial prop definition. A prop with no `type` is a `string`. */
export type PlutoBlockPropPatch = Partial<PlutoBlockPropDefinition>

/**
 * A partial block definition: one layer of the sources (the component layer, or the site
 * override). `Props` is the prop interface of a component, so `definePlutoBlock<Props>()` can
 * check the keys of `props`. A prop or a slot set to `false` is removed from the layers below.
 */
export interface PlutoBlockPatch<
  Props extends object = Record<string, unknown>,
> extends Partial<Omit<PlutoBlockDefinition, 'name' | 'props' | 'slots'>> {
  props?: { [Key in keyof Props & string]?: PlutoBlockPropPatch | false }
  slots?: Record<string, PlutoBlockSlotDefinition | false>
}

/** One layer for one block: a partial definition, or `false` to hide the block from the palette. */
export type PlutoBlockOverride = PlutoBlockPatch | false

/** The blocks of one layer, by component name (kebab case). */
export type PlutoBlocksConfig = Record<string, PlutoBlockOverride>

/**
 * The layers that join the preset into a block definition. The component layer comes from the
 * component files (it is empty until the build step fills it). The overrides are `plutoBlocks`
 * in `app.config.ts`, and they win.
 */
export interface PlutoBlockSources {
  components?: PlutoBlocksConfig
  overrides?: PlutoBlocksConfig
}

/** The theme colors of Nuxt UI. A prop whose values are all colors gets the color widget. */
export const BLOCK_COLORS = [
  'primary',
  'secondary',
  'success',
  'info',
  'warning',
  'error',
  'neutral',
]

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
export function sameKey(map: object, key: string): string {
  if (key in map) {
    return key
  }
  const camel = camelKey(key)
  return Object.keys(map).find((other) => camelKey(other) === camel) ?? key
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
