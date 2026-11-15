import type { PlutoPropValue } from './definition'
export type * from './definition'

export interface PlutoSlice {
  start: number
  end: number
  text: string
}

interface PlutoBlockBase {
  id: string
  original?: PlutoSlice
  indent?: string
}

export interface PlutoTextBlock extends PlutoBlockBase {
  kind: 'text'
  markdown: string
}

export interface PlutoCodeBlock extends PlutoBlockBase {
  kind: 'code'
  lang: string
  filename?: string
  meta?: string
  fence: string
  code: string
}

export type PlutoPropsStyle = 'inline' | 'yaml'

export interface PlutoComponentBlock extends PlutoBlockBase {
  kind: 'component'
  name: string
  props: Record<string, PlutoPropValue>
  propsStyle: PlutoPropsStyle
  propOrder: string[]
  propSource: Record<string, { value: PlutoPropValue; text: string }>
  colons: number
  slots: Record<string, PlutoBlock[]>
  gaps: string[]
  yamlHead?: string
  openerText: string
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
  gaps: string[]
}

export interface PlutoBlockLocation {
  block: PlutoBlock
  parent?: PlutoComponentBlock
  slot?: string
  index: number
}
