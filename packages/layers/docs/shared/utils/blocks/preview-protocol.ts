// The messages between the editor and the preview frame (`/_pluto/preview`).
// Both sides check the origin and the shape of each message. Types and
// validators only: no DOM, no Nuxt.

export const PREVIEW_PATH = '/_pluto/preview'

/** The version of the protocol. Change it when a message changes in a way that breaks the other side. */
export const PREVIEW_PROTOCOL_VERSION = 1

/** Every message has this `source`, so the frame ignores the messages of other scripts. */
export const PREVIEW_SOURCE = 'pluto-preview'

/** An inner component of a block, so the preview can mark it and a click can select it. */
export interface PlutoPreviewChild {
  id: string
  /** The component name, as in the Markdown (`card`, `u-page-feature`). */
  name: string
  /** The label for the outline in the preview. */
  label?: string
  /** The inner components of this component, in source order over all slots. */
  children?: PlutoPreviewChild[]
}

export interface PlutoPreviewBlock {
  id: string
  markdown: string
  /** `false` shows a placeholder card instead of the block. */
  preview?: boolean
  /** The label for the placeholder card and the outline. */
  label?: string
  /** The inner components of a component block, in source order over all slots. */
  children?: PlutoPreviewChild[]
}

interface Envelope<T extends string> {
  source: typeof PREVIEW_SOURCE
  version: typeof PREVIEW_PROTOCOL_VERSION
  type: T
}

// The editor to the frame

export interface PlutoPreviewRender extends Envelope<'render'> {
  frontmatter: Record<string, unknown>
  blocks: PlutoPreviewBlock[]
  selectedId?: string | null
}

export interface PlutoPreviewSelect extends Envelope<'select'> {
  /** `null` clears the selection. */
  id: string | null
}

export interface PlutoPreviewScrollTo extends Envelope<'scroll-to'> {
  id: string
}

export type PlutoPreviewToFrame =
  PlutoPreviewRender | PlutoPreviewSelect | PlutoPreviewScrollTo

// The frame to the editor

export type PlutoPreviewReady = Envelope<'ready'>

export interface PlutoPreviewHover extends Envelope<'hover'> {
  id: string | null
}

export interface PlutoPreviewError extends Envelope<'error'> {
  /** The block that failed, or none for an error of the whole page. */
  id?: string
  message: string
}

export type PlutoPreviewFromFrame =
  PlutoPreviewReady | PlutoPreviewSelect | PlutoPreviewHover | PlutoPreviewError

export type PlutoPreviewMessage = PlutoPreviewToFrame | PlutoPreviewFromFrame

export type PlutoPreviewDirection = 'to-frame' | 'from-frame'

export function previewMessage<T extends PlutoPreviewMessage['type']>(
  type: T,
  body: Omit<Extract<PlutoPreviewMessage, { type: T }>, keyof Envelope<T>>
): Extract<PlutoPreviewMessage, { type: T }> {
  return {
    source: PREVIEW_SOURCE,
    version: PREVIEW_PROTOCOL_VERSION,
    type,
    ...body,
  } as Extract<PlutoPreviewMessage, { type: T }>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

// A real page nests a few levels. The limit stops a message that nests without end.
const MAX_CHILD_DEPTH = 16

function isChildList(
  value: unknown,
  depth: number
): value is PlutoPreviewChild[] {
  return (
    Array.isArray(value) &&
    depth <= MAX_CHILD_DEPTH &&
    value.every(
      (child) =>
        isRecord(child) &&
        typeof child.id === 'string' &&
        typeof child.name === 'string' &&
        (child.label === undefined || typeof child.label === 'string') &&
        (child.children === undefined || isChildList(child.children, depth + 1))
    )
  )
}

function isBlock(value: unknown): value is PlutoPreviewBlock {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.markdown === 'string' &&
    (value.preview === undefined || typeof value.preview === 'boolean') &&
    (value.label === undefined || typeof value.label === 'string') &&
    (value.children === undefined || isChildList(value.children, 1))
  )
}

const TO_FRAME = new Set(['render', 'select', 'scroll-to'])
const FROM_FRAME = new Set(['ready', 'select', 'hover', 'error'])

/**
 * Checks the shape of a message that arrives from `postMessage`. It returns
 * the typed message, or `undefined` for anything else: wrong source, wrong
 * version, wrong direction, or a wrong field.
 */
export function parsePreviewMessage(
  data: unknown,
  direction: PlutoPreviewDirection
): PlutoPreviewMessage | undefined {
  if (
    !isRecord(data) ||
    data.source !== PREVIEW_SOURCE ||
    data.version !== PREVIEW_PROTOCOL_VERSION ||
    typeof data.type !== 'string'
  ) {
    return undefined
  }
  if (!(direction === 'to-frame' ? TO_FRAME : FROM_FRAME).has(data.type)) {
    return undefined
  }
  switch (data.type) {
    case 'render':
      return isRecord(data.frontmatter) &&
        Array.isArray(data.blocks) &&
        data.blocks.every(isBlock) &&
        (data.selectedId === undefined || isNullableString(data.selectedId))
        ? (data as unknown as PlutoPreviewRender)
        : undefined
    case 'select':
    case 'hover':
      return isNullableString(data.id) &&
        (data.type === 'hover' ||
          direction === 'to-frame' ||
          typeof data.id === 'string')
        ? (data as unknown as PlutoPreviewSelect)
        : undefined
    case 'scroll-to':
      return typeof data.id === 'string'
        ? (data as unknown as PlutoPreviewScrollTo)
        : undefined
    case 'ready':
      return data as unknown as PlutoPreviewReady
    case 'error':
      return typeof data.message === 'string' &&
        (data.id === undefined || typeof data.id === 'string')
        ? (data as unknown as PlutoPreviewError)
        : undefined
    default:
      return undefined
  }
}

/** True when the origin of a message is the expected one. The preview is same-origin, so `expected` is `location.origin`. */
export function isTrustedPreviewOrigin(
  origin: string,
  expected: string
): boolean {
  return origin !== '' && origin !== 'null' && origin === expected
}
