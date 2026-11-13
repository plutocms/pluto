import type { PlutoPropValue } from '#layers/pluto/shared/utils/blocks/definition'
export type * from '#layers/pluto/shared/utils/blocks/definition'

// The truth stays the Markdown string: a block with `original` is written back byte for byte.

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

export interface PlutoBlockLocation {
  block: PlutoBlock
  parent?: PlutoComponentBlock
  slot?: string
  /** The index in the list of the document, or in the slot. */
  index: number
}
