import type { BlockNode, ConvertContext, ElementorElement } from './types'
import type { Settings } from './values'
import {
  alignOf,
  boxOf,
  colorOf,
  countIgnored,
  countResponsive,
  imageOf,
  lengthOf,
  note,
  numberOf,
  percentOrLength,
  pxOf,
  radiusOf,
  shadowOf,
  snapSpace,
  text,
} from './values'
import { widgetNodes } from './widgets'

const ADDON_PREFIX = /^(eael|ha|premium|uael|jet)[_-]/

const LEGACY_GAPS: Record<string, number> = {
  no: 0,
  narrow: 10,
  default: 20,
  extended: 30,
  wide: 40,
  wider: 60,
}

const LEGACY_VALIGN: Record<string, string> = {
  top: 'start',
  middle: 'center',
  center: 'center',
  bottom: 'end',
}

function legacyValign(value: unknown): string | undefined {
  return LEGACY_VALIGN[text(value) ?? '']
}

function settingsOf(element: ElementorElement): Settings {
  return element.settings ?? {}
}

function visit(ctx: ConvertContext, element: ElementorElement): boolean {
  const settings = settingsOf(element)

  if (text(settings.hide_desktop)) {
    ctx.report.ignoredStyles['hidden on desktop (skipped)'] =
      (ctx.report.ignoredStyles['hidden on desktop (skipped)'] ?? 0) + 1

    return false
  }

  countResponsive(ctx, settings)

  const prefixes = [
    ...Object.keys(settings).map((key) => ADDON_PREFIX.exec(key)?.[1]),
    ADDON_PREFIX.exec(element.widgetType ?? '')?.[1],
  ]

  for (const prefix of prefixes) {
    if (prefix) {
      note(ctx.report.addonPrefixes, `${prefix}_`)
    }
  }

  countIgnored(ctx, settings, ['__dynamic__'], 'dynamic values')
  countIgnored(
    ctx,
    settings,
    ['margin', '_margin', '_padding'],
    'margins and widget padding'
  )
  countIgnored(
    ctx,
    settings,
    [
      'css_filters_css_filter',
      '_animation',
      'animation',
      'motion_fx_motion_fx_scrolling',
    ],
    'filters and animations'
  )

  return true
}

function visible(
  ctx: ConvertContext,
  elements: ElementorElement[] | undefined
): ElementorElement[] {
  return (elements ?? []).filter((element) => visit(ctx, element))
}

function isRow(settings: Settings): boolean {
  const direction = text(settings.flex_direction)

  return direction === 'row' || direction === 'row-reverse'
}

function averageSpace(
  ctx: ConvertContext,
  label: string,
  values: number[],
  from: string
): string {
  const average = values.reduce((sum, value) => sum + value, 0) / values.length

  return snapSpace(ctx, label, average, from)
}

function sidesText(values: number[]): string {
  const unique = [...new Set(values)]

  return unique.map((value) => `${value}px`).join(' and ')
}

interface Background {
  bg?: string
  image?: string
  overlay?: string
  overlayOpacity?: number
}

function backgroundOf(
  ctx: ConvertContext,
  settings: Settings,
  allowImage: boolean
): Background {
  const type = text(settings.background_background)
  const result: Background = {}

  if (type === 'classic' || type === 'gradient') {
    result.bg = colorOf(ctx, settings, 'background_color')

    if (type === 'gradient') {
      note(ctx.report.notes, 'A gradient background kept only its first color.')
    }
  }

  if (type === 'classic') {
    const image = imageOf(ctx, settings.background_image)

    if (image && allowImage) {
      result.image = image.url
    } else if (image) {
      ctx.report.ignoredStyles['column background image'] =
        (ctx.report.ignoredStyles['column background image'] ?? 0) + 1
    }
  }

  if (text(settings.background_overlay_background) === 'classic') {
    const size = numberOf(
      (settings.background_overlay_opacity as { size?: unknown } | undefined)
        ?.size
    )
    const opacity = size === undefined ? 0.5 : size > 1 ? size / 100 : size
    const overlayImage = allowImage
      ? imageOf(ctx, settings.background_overlay_image)
      : undefined
    const overlayColor = colorOf(ctx, settings, 'background_overlay_color')

    if (overlayImage && !result.image) {
      result.image = overlayImage.url

      if (result.bg) {
        result.overlay = result.bg
        result.overlayOpacity = Math.round((1 - opacity) * 100)
        result.bg = undefined
      }
    } else if (overlayColor && result.image) {
      result.overlay = overlayColor
      result.overlayOpacity = Math.round(opacity * 100)
    } else if (overlayColor && !result.bg) {
      result.bg = overlayColor
    }
  }

  return result
}

function sectionPadding(ctx: ConvertContext, settings: Settings): string {
  const box = boxOf(settings.padding)

  if (!box) {
    return 'none'
  }

  return averageSpace(
    ctx,
    'section padding',
    [box.top, box.bottom],
    sidesText([box.top, box.bottom])
  )
}

function alignsOf(
  settings: Settings,
  row: boolean
): { align?: string; valign?: string } {
  if (row) {
    return {}
  }

  return {
    align: alignOf(settings.flex_align_items),
    valign: alignOf(settings.flex_justify_content),
  }
}

function sectionProps(
  ctx: ConvertContext,
  element: ElementorElement
): BlockNode['props'] {
  const settings = settingsOf(element)
  const legacy = element.elType === 'section'
  const background = backgroundOf(ctx, settings, true)
  const widthKey = legacy ? 'layout' : 'content_width'
  const full = legacy
    ? text(settings[widthKey]) === 'full_width'
    : text(settings[widthKey]) === 'full'
  const boxed = legacy
    ? pxOf(settings.content_width)
    : pxOf(settings.boxed_width)
  const minHeight = legacy
    ? text(settings.height) === 'full'
      ? '100vh'
      : text(settings.height) === 'min-height'
        ? lengthOf(settings.custom_height)
        : undefined
    : lengthOf(settings.min_height)
  const position = legacy
    ? { valign: legacyValign(settings.content_position) }
    : alignsOf(settings, isRow(settings))

  countIgnored(
    ctx,
    settings,
    ['border_border', 'box_shadow_box_shadow_type', 'border_radius'],
    'borders, shadows and radius on a section'
  )

  return {
    anchor: text(settings._element_id),
    bg: background.bg,
    image: background.image,
    overlay: background.overlay,
    overlayOpacity: background.overlayOpacity,
    padding: sectionPadding(ctx, settings),
    minHeight,
    width: full ? 'full' : undefined,
    maxWidth: !full && boxed && boxed !== 1140 ? `${boxed}px` : undefined,
    align: 'align' in position ? position.align : undefined,
    valign: position.valign,
  }
}

function hasBox(settings: Settings): boolean {
  const type = text(settings.background_background)
  const background =
    (type === 'classic' || type === 'gradient') &&
    Boolean(
      text(settings.background_color) ||
      text((settings.background_image as { url?: unknown } | undefined)?.url)
    )
  const box = boxOf(settings.padding)
  const padding = box
    ? (box.top + box.right + box.bottom + box.left) / 4 >= 12
    : false
  const radius = Boolean(radiusProbe(settings))

  return (
    background ||
    padding ||
    radius ||
    text(settings.box_shadow_box_shadow_type) === 'yes' ||
    Boolean(text(settings.border_border))
  )
}

function radiusProbe(settings: Settings): boolean {
  const value = settings.border_radius

  if (typeof value !== 'object' || value === null) {
    return false
  }

  return ['top', 'right', 'bottom', 'left'].some(
    (side) => (numberOf((value as Record<string, unknown>)[side]) ?? 0) > 0
  )
}

function columnWidth(element: ElementorElement): string | undefined {
  const settings = settingsOf(element)

  if (element.elType === 'column') {
    const size =
      numberOf(settings._inline_size) ?? numberOf(settings._column_size)

    return size === undefined || size <= 0 ? undefined : String(size)
  }

  return percentOrLength(settings.width)
}

function columnProps(
  ctx: ConvertContext,
  element: ElementorElement,
  withWidth: boolean
): BlockNode['props'] {
  const settings = settingsOf(element)
  const legacy = element.elType === 'column'
  const background = backgroundOf(ctx, settings, false)
  const box = boxOf(settings.padding)
  const padding = box
    ? averageSpace(
        ctx,
        'column padding',
        [box.top, box.right, box.bottom, box.left],
        sidesText([box.top, box.right, box.bottom, box.left])
      )
    : undefined
  const position = legacy
    ? {
        align: undefined,
        valign: legacyValign(settings.content_position),
      }
    : alignsOf(settings, isRow(settings))

  countIgnored(ctx, settings, ['border_border'], 'borders')

  if (!legacy && !isRow(settings) && settings.flex_gap) {
    ctx.report.ignoredStyles['gap between stacked blocks'] =
      (ctx.report.ignoredStyles['gap between stacked blocks'] ?? 0) + 1
  }

  return {
    width: withWidth ? columnWidth(element) : undefined,
    padding: padding === 'none' ? undefined : padding,
    bg: background.bg,
    radius: radiusOf(ctx, settings),
    shadow: shadowOf(ctx, settings),
    align: position.align,
    valign: position.valign,
  }
}

function gapOf(ctx: ConvertContext, settings: Settings): string | undefined {
  const gap = settings.flex_gap as
    { column?: unknown; size?: unknown; unit?: unknown } | undefined

  if (!gap) {
    return undefined
  }

  const value = numberOf(gap.column) ?? numberOf(gap.size)
  const unit = text(gap.unit) ?? 'px'
  const px = value === undefined ? undefined : pxOf({ unit, size: value })

  return px === undefined ? undefined : snapSpace(ctx, 'column gap', px)
}

function rowProps(ctx: ConvertContext, settings: Settings): BlockNode['props'] {
  const align = text(settings.flex_align_items)
  const valign = { 'flex-start': 'start', center: 'center', 'flex-end': 'end' }[
    align ?? ''
  ]

  if (text(settings.flex_justify_content)) {
    ctx.report.ignoredStyles['horizontal spacing of a row'] =
      (ctx.report.ignoredStyles['horizontal spacing of a row'] ?? 0) + 1
  }

  return {
    gap: gapOf(ctx, settings),
    valign,
    wrap: text(settings.flex_wrap) === 'nowrap' ? false : undefined,
    stack: text(settings.flex_direction_mobile) === 'row' ? 'never' : undefined,
  }
}

function legacyRowProps(
  ctx: ConvertContext,
  settings: Settings
): BlockNode['props'] {
  const custom = pxOf(settings.gap_columns_custom)
  const named = LEGACY_GAPS[text(settings.gap) ?? 'default'] ?? 20
  const px = custom === undefined ? named : custom * 2
  const content = text(settings.content_position)

  return {
    gap: snapSpace(ctx, 'column gap', px),
    valign: legacyValign(content),
  }
}

function wrapBox(
  ctx: ConvertContext,
  element: ElementorElement,
  inner: BlockNode[]
): BlockNode {
  return {
    name: 'block-columns',
    props: {},
    children: [
      {
        name: 'block-column',
        props: columnProps(ctx, element, false),
        children: inner,
      },
    ],
  }
}

function columnNode(ctx: ConvertContext, element: ElementorElement): BlockNode {
  if (element.elType === 'widget') {
    return {
      name: 'block-column',
      props: {},
      children: widgetNodes(ctx, element),
    }
  }

  return {
    name: 'block-column',
    props: columnProps(ctx, element, true),
    children: body(ctx, element),
  }
}

function stack(ctx: ConvertContext, elements: ElementorElement[]): BlockNode[] {
  return elements.flatMap((element) => {
    if (element.elType === 'widget') {
      return widgetNodes(ctx, element)
    }

    const inner = body(ctx, element)

    return hasBox(settingsOf(element)) && inner.length > 0
      ? [wrapBox(ctx, element, inner)]
      : inner
  })
}

function legacySectionBody(
  ctx: ConvertContext,
  element: ElementorElement
): BlockNode[] {
  const columns = visible(ctx, element.elements).filter(
    (child) => child.elType === 'column'
  )
  const first = columns[0]

  if (!first) {
    return []
  }

  if (columns.length === 1) {
    const inner = body(ctx, first)

    return hasBox(settingsOf(first)) && inner.length > 0
      ? [wrapBox(ctx, first, inner)]
      : inner
  }

  return [
    {
      name: 'block-columns',
      props: legacyRowProps(ctx, settingsOf(element)),
      children: columns.map((column) => columnNode(ctx, column)),
    },
  ]
}

function body(ctx: ConvertContext, element: ElementorElement): BlockNode[] {
  if (element.elType === 'section') {
    return legacySectionBody(ctx, element)
  }

  const children = visible(ctx, element.elements)

  if (element.elType === 'column') {
    return stack(ctx, children)
  }

  if (isRow(settingsOf(element)) && children.length > 1) {
    return [
      {
        name: 'block-columns',
        props: rowProps(ctx, settingsOf(element)),
        children: children.map((child) => columnNode(ctx, child)),
      },
    ]
  }

  return stack(ctx, children)
}

function topLevel(ctx: ConvertContext, element: ElementorElement): BlockNode[] {
  if (element.elType === 'widget') {
    const children = widgetNodes(ctx, element)

    return children.length > 0
      ? [{ name: 'block-section', props: { padding: 'none' }, children }]
      : []
  }

  const props = sectionProps(ctx, element)
  const children = body(ctx, element)
  const visual =
    props.bg || props.image || props.minHeight || props.overlay || props.anchor

  if (children.length === 0 && !visual) {
    return []
  }

  return [{ name: 'block-section', props, children }]
}

/** Turns the elements of an Elementor page into block nodes: one section per top-level element. */
export function convertElements(
  ctx: ConvertContext,
  elements: ElementorElement[]
): BlockNode[] {
  return visible(ctx, elements).flatMap((element) => topLevel(ctx, element))
}
