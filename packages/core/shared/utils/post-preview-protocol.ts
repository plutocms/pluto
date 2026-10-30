// The messages between the post editor (`post-canvas`) and the post preview frame
// (`/_pluto/post-preview`). Both sides check the origin and the shape of each message.
// Types and validators only: no DOM, no Nuxt.

/** Every message has this `source`, so each side ignores the messages of other scripts. */
export const PLUTO_POST_PREVIEW_SOURCE = 'pluto-post-preview'

/** The version of the protocol. Change it when a message changes in a way that breaks a side. */
export const PLUTO_POST_PREVIEW_VERSION = 1

interface Envelope<T extends string> {
  source: typeof PLUTO_POST_PREVIEW_SOURCE
  version: typeof PLUTO_POST_PREVIEW_VERSION
  type: T
}

// The editor to the frame

/** Render the post: the other fields of the item, and the Markdown body. */
export interface PlutoPostPreviewRender extends Envelope<'render'> {
  /** The content type name, for example `post`. */
  contentType: string
  /** The fields of the item, without the body. Plain JSON values. */
  item: Record<string, unknown>
  markdown: string
}

/** Scroll to a heading of the body: its index in source order, from 0. */
export interface PlutoPostPreviewScrollTo extends Envelope<'scroll-to'> {
  heading: number
}

/** The largest `inset` the frame accepts, in px. */
export const PLUTO_POST_PREVIEW_MAX_INSET = 200

/**
 * Keep space free at the right of the page, in px (0 for none). The editor sends it while the
 * open button of the closed right panel floats over the preview.
 */
export interface PlutoPostPreviewInset extends Envelope<'inset'> {
  end: number
}

export type PlutoPostPreviewToFrame =
  PlutoPostPreviewRender | PlutoPostPreviewScrollTo | PlutoPostPreviewInset

// The frame to the editor

export type PlutoPostPreviewReady = Envelope<'ready'>

export type PlutoPostPreviewFromFrame = PlutoPostPreviewReady

export type PlutoPostPreviewMessage =
  PlutoPostPreviewToFrame | PlutoPostPreviewFromFrame

/** Builds a message with the envelope. */
export function plutoPostPreviewMessage<
  T extends PlutoPostPreviewMessage['type'],
>(
  type: T,
  body: Omit<Extract<PlutoPostPreviewMessage, { type: T }>, keyof Envelope<T>>
): Extract<PlutoPostPreviewMessage, { type: T }> {
  return {
    source: PLUTO_POST_PREVIEW_SOURCE,
    version: PLUTO_POST_PREVIEW_VERSION,
    type,
    ...body,
  } as Extract<PlutoPostPreviewMessage, { type: T }>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Checks the shape of a message that arrives from `postMessage`. It returns the typed message, or
 * `undefined` for anything else: a wrong source, version, direction or field.
 */
export function parsePlutoPostPreviewMessage(
  data: unknown,
  direction: 'to-frame' | 'from-frame'
): PlutoPostPreviewMessage | undefined {
  if (
    !isRecord(data) ||
    data.source !== PLUTO_POST_PREVIEW_SOURCE ||
    data.version !== PLUTO_POST_PREVIEW_VERSION
  ) {
    return undefined
  }
  if (direction === 'from-frame') {
    return data.type === 'ready'
      ? (data as unknown as PlutoPostPreviewReady)
      : undefined
  }
  if (data.type === 'render') {
    return typeof data.contentType === 'string' &&
      isRecord(data.item) &&
      typeof data.markdown === 'string'
      ? (data as unknown as PlutoPostPreviewRender)
      : undefined
  }
  if (data.type === 'scroll-to') {
    return Number.isInteger(data.heading) && (data.heading as number) >= 0
      ? (data as unknown as PlutoPostPreviewScrollTo)
      : undefined
  }
  if (data.type === 'inset') {
    return Number.isInteger(data.end) &&
      (data.end as number) >= 0 &&
      (data.end as number) <= PLUTO_POST_PREVIEW_MAX_INSET
      ? (data as unknown as PlutoPostPreviewInset)
      : undefined
  }
  return undefined
}

/**
 * True when a message event comes from the same origin as the page. The editor and the frame are
 * on the same origin, so any other origin is a foreign script.
 */
export function isTrustedPlutoPostPreviewOrigin(
  origin: string,
  pageOrigin: string
): boolean {
  return origin === pageOrigin
}
