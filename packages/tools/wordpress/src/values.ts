import type { ConvertContext } from './types'

export type Settings = Record<string, unknown>

const SYSTEM_COLORS = new Set(['primary', 'secondary', 'text', 'accent'])

const RESPONSIVE_KEY =
  /_(?:tablet|mobile|laptop|widescreen|mobile_extra|tablet_extra)$/

const COLOR_FUNCTION = /^(?:rgb|rgba|hsl|hsla)\([\d\s.,%/-]+\)$/i

const HEX_COLOR = /^#[0-9a-f]{3,8}$/i

const GLOBAL_VARIABLE = /^var\(--e-global-color-([\w-]+)\)$/

const LENGTH_UNITS = new Set([
  'px',
  'rem',
  'em',
  '%',
  'vh',
  'vw',
  'vmin',
  'vmax',
  'svh',
  'dvh',
  'ch',
])

export const SPACE_SCALE: [string, number][] = [
  ['none', 0],
  ['xs', 8],
  ['sm', 16],
  ['md', 24],
  ['lg', 48],
  ['xl', 80],
  ['2xl', 128],
]

export const RADIUS_SCALE: [string, number][] = [
  ['none', 0],
  ['sm', 4],
  ['md', 8],
  ['lg', 16],
  ['xl', 24],
  ['full', 9999],
]

export const HEADING_SCALE: [string, number][] = [
  ['sm', 18],
  ['md', 24],
  ['lg', 36],
  ['xl', 48],
  ['2xl', 64],
  ['3xl', 88],
]

export const HEADING_DEFAULTS: Record<number, number> = {
  1: 60,
  2: 40,
  3: 28,
  4: 20,
  5: 16,
  6: 16,
}

export const TEXT_SCALE: [string, number][] = [
  ['sm', 14],
  ['', 16],
  ['lg', 18],
  ['xl', 22],
]

export const ICON_SCALE: [string, number][] = [
  ['sm', 16],
  ['md', 24],
  ['lg', 32],
  ['xl', 48],
  ['2xl', 72],
]

export function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function numberOf(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)

    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

export function isHidden(settings: Settings): boolean {
  return Boolean(text(settings.hide_desktop))
}

export function countResponsive(ctx: ConvertContext, settings: Settings) {
  for (const key of Object.keys(settings)) {
    if (
      RESPONSIVE_KEY.test(key) ||
      key === 'hide_tablet' ||
      key === 'hide_mobile'
    ) {
      ctx.report.droppedResponsive++
    }
  }
}

export function countIgnored(
  ctx: ConvertContext,
  settings: Settings,
  keys: string[],
  label: string
) {
  const hit = keys.filter((key) => {
    const value = settings[key]

    return value !== undefined && value !== '' && value !== 'none'
  })

  if (hit.length > 0) {
    ctx.report.ignoredStyles[label] = (ctx.report.ignoredStyles[label] ?? 0) + 1
  }
}

export function note(list: string[], entry: string) {
  if (!list.includes(entry)) {
    list.push(entry)
  }
}

export function normalizeColor(value: string): string | undefined {
  const color = value.trim()

  if (HEX_COLOR.test(color) || COLOR_FUNCTION.test(color)) {
    return color
  }

  return undefined
}

function kitColor(ctx: ConvertContext, id: string): string | undefined {
  if (SYSTEM_COLORS.has(id)) {
    return id
  }

  const hex = ctx.kit.globalColors[id]

  return hex ? normalizeColor(hex) : undefined
}

/** A color setting as a token (`primary`) for a kit color, else the exact CSS color. */
export function colorOf(
  ctx: ConvertContext,
  settings: Settings,
  key: string
): string | undefined {
  const globals = settings.__globals__ as Record<string, unknown> | undefined
  const reference = text(globals?.[key])

  if (reference?.startsWith('globals/colors')) {
    const id = new URLSearchParams(reference.split('?')[1] ?? '').get('id')
    const color = id ? kitColor(ctx, id) : undefined

    if (color) {
      return color
    }
  }

  const literal = text(settings[key])

  if (!literal) {
    return undefined
  }

  const variable = GLOBAL_VARIABLE.exec(literal)?.[1]

  return variable ? kitColor(ctx, variable) : normalizeColor(literal)
}

export function pxOf(value: unknown): number | undefined {
  if (typeof value === 'object' && value !== null) {
    const record = value as { unit?: unknown; size?: unknown }
    const size = numberOf(record.size)

    if (size === undefined) {
      return undefined
    }

    const unit = text(record.unit) ?? 'px'

    if (unit === 'px') {
      return size
    }

    return unit === 'em' || unit === 'rem' ? size * 16 : undefined
  }

  return numberOf(value)
}

export interface Box {
  top: number
  right: number
  bottom: number
  left: number
}

export function boxOf(value: unknown): Box | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }

  const record = value as Record<string, unknown>
  const unit = text(record.unit) ?? 'px'
  const factor = unit === 'px' ? 1 : unit === 'em' || unit === 'rem' ? 16 : 0

  if (factor === 0) {
    return undefined
  }

  const side = (name: string) => (numberOf(record[name]) ?? 0) * factor

  return {
    top: side('top'),
    right: side('right'),
    bottom: side('bottom'),
    left: side('left'),
  }
}

export function nearest(
  px: number,
  scale: [string, number][]
): { token: string; exact: boolean } {
  let best = scale[0]!

  for (const entry of scale) {
    if (Math.abs(entry[1] - px) < Math.abs(best[1] - px)) {
      best = entry
    }
  }

  return { token: best[0], exact: best[1] === px }
}

function pxText(px: number): string {
  return `${Math.round(px * 100) / 100}px`
}

/** Rounds a size in pixels to the space scale (`none` to `2xl`) and reports a change. */
export function snapSpace(
  ctx: ConvertContext,
  label: string,
  px: number,
  from?: string
): string {
  const { token, exact } = nearest(Math.max(px, 0), SPACE_SCALE)

  if (!exact) {
    note(
      ctx.report.roundings,
      `${label}: ${from ?? pxText(px)} became ${token}`
    )
  }

  return token
}

export function lengthOf(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) {
    const plain = numberOf(value)

    return plain === undefined ? undefined : `${plain}px`
  }

  const record = value as { unit?: unknown; size?: unknown }
  const size = numberOf(record.size)
  const unit = text(record.unit) ?? 'px'

  if (size === undefined || size <= 0 || !LENGTH_UNITS.has(unit)) {
    return undefined
  }

  return `${size}${unit}`
}

export function percentOrLength(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }

  const record = value as { unit?: unknown; size?: unknown }
  const size = numberOf(record.size)
  const unit = text(record.unit) ?? 'px'

  if (size === undefined || size <= 0) {
    return undefined
  }

  if (unit === '%') {
    return String(size)
  }

  return unit === 'px' || unit === 'rem' || unit === 'em'
    ? `${size}${unit}`
    : undefined
}

export function alignOf(value: unknown): string | undefined {
  switch (text(value)) {
    case 'left':
    case 'start':
    case 'flex-start':
      return 'start'
    case 'center':
      return 'center'
    case 'right':
    case 'end':
    case 'flex-end':
      return 'end'
    default:
      return undefined
  }
}

export interface LinkValue {
  url: string
  target?: string
}

export function linkOf(value: unknown, base?: string): LinkValue | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }

  const record = value as { url?: unknown; is_external?: unknown }
  const url = text(record.url)

  if (!url || url.startsWith('#elementor-action')) {
    return undefined
  }

  return {
    url: base ? localUrl(url, base) : url,
    target: text(record.is_external) ? '_blank' : undefined,
  }
}

/**
 * A link to a page of the old site becomes a path (`/about`), because the new pages keep their
 * slugs. Any other link stays as it is. A file of `wp-content` stays on the old site.
 */
export function localUrl(url: string, base: string): string {
  if (/^(?:mailto:|tel:|#)/i.test(url)) {
    return url
  }

  try {
    const parsed = new URL(url, base)

    if (
      parsed.origin !== new URL(base).origin ||
      /^\/wp-(?:content|admin|includes)\//.test(parsed.pathname)
    ) {
      return /^https?:/i.test(url) ? url : parsed.toString()
    }

    const path =
      parsed.pathname.length > 1
        ? parsed.pathname.replace(/\/+$/, '')
        : parsed.pathname

    return `${path}${parsed.search}${parsed.hash}`
  } catch {
    return url
  }
}

export function absoluteUrl(url: string, base: string): string {
  if (/^(?:https?:|mailto:|tel:|#|data:)/i.test(url)) {
    return url
  }

  try {
    return new URL(url, base || 'http://localhost').toString()
  } catch {
    return url
  }
}

const PLACEHOLDER_IMAGE = /elementor\/assets\/images\/placeholder/

export function imageOf(
  ctx: ConvertContext,
  value: unknown
): { url: string; alt: string } | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }

  const record = value as { url?: unknown; id?: unknown; alt?: unknown }
  const attachment = ctx.attachments.get(Number(record.id))
  const source = text(record.url) ?? attachment?.url

  if (!source || PLACEHOLDER_IMAGE.test(source)) {
    return undefined
  }

  const url = absoluteUrl(source, ctx.baseUrl)
  const alt = text(record.alt) ?? attachment?.alt ?? ''

  if (/^https?:/i.test(url) && !ctx.images.get(url)) {
    ctx.images.set(url, alt)
  }

  return { url, alt }
}

export function radiusOf(
  ctx: ConvertContext,
  settings: Settings,
  key = 'border_radius'
): string | undefined {
  const value = settings[key]

  if (typeof value !== 'object' || value === null) {
    return undefined
  }

  const record = value as Record<string, unknown>
  const corners = ['top', 'right', 'bottom', 'left'].map(
    (name) => numberOf(record[name]) ?? 0
  )
  const largest = Math.max(...corners)

  if (largest <= 0) {
    return undefined
  }

  if (text(record.unit) === '%') {
    return largest >= 40 ? 'full' : nearest(largest * 2, RADIUS_SCALE).token
  }

  const px = pxOf({ unit: record.unit, size: largest })

  if (px === undefined) {
    return undefined
  }

  const { token, exact } = nearest(px >= 100 ? 9999 : px, RADIUS_SCALE)

  if (!exact && token !== 'full') {
    note(ctx.report.roundings, `border radius: ${pxText(px)} became ${token}`)
  }

  return token === 'none' ? undefined : token
}

export function shadowOf(
  ctx: ConvertContext,
  settings: Settings
): string | undefined {
  if (text(settings.box_shadow_box_shadow_type) !== 'yes') {
    return undefined
  }

  const shadow = settings.box_shadow_box_shadow as
    { blur?: unknown } | undefined
  const blur = numberOf(shadow?.blur) ?? 10
  const token = blur <= 5 ? 'sm' : blur <= 24 ? 'md' : 'lg'

  note(ctx.report.roundings, `box shadow: blur ${blur}px became ${token}`)

  return token
}

export function addFont(
  ctx: ConvertContext,
  family: string,
  weight: string | undefined
) {
  const weights = ctx.fonts.get(family) ?? new Set<string>()

  if (weight && /^\d{3}$/.test(weight)) {
    weights.add(weight)
  }

  ctx.fonts.set(family, weights)
}

export const SYSTEM_FONTS = new Set([
  'arial',
  'tahoma',
  'verdana',
  'helvetica',
  'times new roman',
  'trebuchet ms',
  'georgia',
])

export function readTypography(ctx: ConvertContext, settings: Settings) {
  const family = text(settings.typography_font_family)

  if (family && !SYSTEM_FONTS.has(family.toLowerCase())) {
    addFont(ctx, family, text(settings.typography_font_weight))

    const known = [ctx.kit.headingFont, ctx.kit.bodyFont]

    if (!known.includes(family)) {
      note(ctx.report.notes, `Font family "${family}" is not kept on a block.`)
    }
  }

  const ignored = [
    'typography_font_weight',
    'typography_text_transform',
    'typography_line_height',
    'typography_letter_spacing',
    'typography_font_style',
    'typography_text_decoration',
    'typography_word_spacing',
  ]

  countIgnored(ctx, settings, ignored, 'typography (weight, case, spacing)')
}

/** Rounds a font size to a size token, or to the default of the block (`''`). */
export function snapFontSize(
  ctx: ConvertContext,
  label: string,
  settings: Settings,
  scale: [string, number][]
): string | undefined {
  const px = pxOf(settings.typography_font_size)

  if (px === undefined) {
    return undefined
  }

  const { token, exact } = nearest(px, scale)

  if (!exact) {
    note(
      ctx.report.roundings,
      `${label} size: ${pxText(px)} became ${token || 'the default size'}`
    )
  }

  return token || undefined
}
