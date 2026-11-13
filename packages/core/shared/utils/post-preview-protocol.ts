export const PLUTO_POST_PREVIEW_SOURCE = 'pluto-post-preview'

export const PLUTO_POST_PREVIEW_VERSION = 1

interface Envelope<T extends string> {
  source: typeof PLUTO_POST_PREVIEW_SOURCE
  version: typeof PLUTO_POST_PREVIEW_VERSION
  type: T
}

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

const PLUTO_POST_PREVIEW_MAX_INSET = 200

/**
 * Keep space free at the right of the page, in px (0 for none). The editor sends it while the
 * open button of the closed right panel floats over the preview.
 */
export interface PlutoPostPreviewInset extends Envelope<'inset'> {
  end: number
}

/**
 * The color mode of the admin. The editor sends it when the frame is ready and on each change, so
 * the preview follows the light and dark switch of the admin.
 */
export interface PlutoPostPreviewColorMode extends Envelope<'color-mode'> {
  mode: 'light' | 'dark'
}

export type PlutoPostPreviewToFrame =
  | PlutoPostPreviewRender
  | PlutoPostPreviewScrollTo
  | PlutoPostPreviewInset
  | PlutoPostPreviewColorMode

export type PlutoPostPreviewReady = Envelope<'ready'>

export type PlutoPostPreviewFromFrame = PlutoPostPreviewReady

export type PlutoPostPreviewMessage =
  PlutoPostPreviewToFrame | PlutoPostPreviewFromFrame

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
  if (data.type === 'color-mode') {
    return data.mode === 'light' || data.mode === 'dark'
      ? (data as unknown as PlutoPostPreviewColorMode)
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

export function isTrustedPlutoPostPreviewOrigin(
  origin: string,
  pageOrigin: string
): boolean {
  return origin === pageOrigin
}
