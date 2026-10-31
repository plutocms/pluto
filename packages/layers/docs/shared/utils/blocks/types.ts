// Types of the block model. The model has no Nuxt import, so a package can
// own it later. The truth stays the Markdown string: a block with `original`
// is written back byte for byte.

/** A part of the source text that a block came from. */
export interface PlutoSlice {
  start: number
  end: number
  text: string
}

interface PlutoBlockBase {
  id: string
  /** The source text of the block. An edit removes it from the block and its ancestors. */
  original?: PlutoSlice
  /** The white space before the first line of the block, inside a component. */
  indent?: string
}

export interface PlutoTextBlock extends PlutoBlockBase {
  kind: 'text'
  /** Without the indent of the parent component. */
  markdown: string
}

export interface PlutoCodeBlock extends PlutoBlockBase {
  kind: 'code'
  lang: string
  filename?: string
  /** The rest of the info string after the language and the file name. */
  meta?: string
  /** The fence characters, for example three backticks. */
  fence: string
  /** Without the indent of the parent component. */
  code: string
}

export type PlutoPropValue = unknown

export type PlutoPropsStyle = 'inline' | 'yaml'

export interface PlutoComponentBlock extends PlutoBlockBase {
  kind: 'component'
  name: string
  props: Record<string, PlutoPropValue>
  /** Where the props are written: after the name `{a="b"}` or in a YAML block. */
  propsStyle: PlutoPropsStyle
  /** The order of the props in the source. New props go at the end. */
  propOrder: string[]
  /**
   * The source of each prop, for a prop that has not changed. The key is a
   * prop name. The value is the text of the token, or of the YAML entry.
   */
  propSource: Record<string, { value: PlutoPropValue; text: string }>
  /** The colons of the opening line. */
  colons: number
  /** The slots in the order of the source. `default` is the content before the first `#name`. */
  slots: Record<string, PlutoBlock[]>
  /**
   * The text between the children, in source order, over all slots. It has the
   * `#name` lines of the slots. Its length is the number of children plus one.
   */
  gaps: string[]
  /** For `yaml` style: the text between the opening line and the YAML block. */
  yamlHead?: string
  /** The opening line as it was in the source, for the check "did the props change". */
  openerText: string
  /** For `yaml` style: the indent of the YAML entries. */
  yamlIndent?: string
}

export type PlutoRawReason =
  'table' | 'html' | 'inline-mdc' | 'footnote' | 'task-list' | 'unknown'

export interface PlutoRawBlock extends PlutoBlockBase {
  kind: 'raw'
  markdown: string
  reason: PlutoRawReason
}

export type PlutoBlock =
  PlutoTextBlock | PlutoCodeBlock | PlutoComponentBlock | PlutoRawBlock

export interface PlutoBlockDoc {
  blocks: PlutoBlock[]
  /** The original text before, between and after the blocks. Its length is the number of blocks plus one. */
  gaps: string[]
}

/** Where a block is in the tree. `parent` is undefined for a top-level block. */
export interface PlutoBlockLocation {
  block: PlutoBlock
  parent?: PlutoComponentBlock
  slot?: string
  /** The index in the list of the document, or in the slot. */
  index: number
}

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
