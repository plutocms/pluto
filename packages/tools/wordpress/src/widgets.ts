import type { BlockNode, ConvertContext, ElementorElement } from './types'
import type { Settings } from './values'
import { escapeInline, htmlToInline, htmlToMarkdown, stripTags } from './html'
import { DEFAULT_ICON, mapIcon, networkOf } from './icons'
import { RAW_HTML } from './types'
import {
  absoluteUrl,
  alignOf,
  colorOf,
  HEADING_DEFAULTS,
  HEADING_SCALE,
  ICON_SCALE,
  imageOf,
  lengthOf,
  linkOf,
  localUrl,
  nearest,
  note,
  numberOf,
  pxOf,
  radiusOf,
  readTypography,
  snapFontSize,
  snapSpace,
  text,
  TEXT_SCALE,
} from './values'

type Handler = (ctx: ConvertContext, settings: Settings) => BlockNode[]

const DANGEROUS_HTML = /<(?:script|iframe|form|style|object|embed)\b/i

function node(
  name: string,
  props: BlockNode['props'],
  rest: Pick<BlockNode, 'children' | 'text'> = {}
): BlockNode {
  return { name, props, ...rest }
}

function placeholder(
  ctx: ConvertContext,
  summary: string,
  label: string
): BlockNode[] {
  ctx.report.placeholders.push(summary)

  return [node('block-text', {}, { text: `Not imported: ${label}.` })]
}

function listOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === 'object' && entry !== null
      )
    : []
}

function inlineOf(value: unknown): string {
  const source = text(value) ?? ''

  return source.includes('<') ? htmlToInline(source) : escapeInline(source)
}

function plainOf(value: unknown): string {
  return stripTags(text(value) ?? '')
}

function iconProp(ctx: ConvertContext, value: unknown, where: string) {
  const result = mapIcon(value)

  if (!result.mapped) {
    note(ctx.report.unmappedIcons, `${result.source} (${where})`)
  }

  return result.icon
}

function richText(ctx: ConvertContext, html: unknown): string {
  const source = text(html)

  if (!source) {
    return ''
  }

  const result = htmlToMarkdown(source)

  for (const url of result.images) {
    const absolute = absoluteUrl(url, ctx.baseUrl)

    if (/^https?:/i.test(absolute) && !ctx.images.has(absolute)) {
      ctx.images.set(absolute, '')
    }
  }

  for (const code of result.shortcodes) {
    note(ctx.report.shortcodes, code)
  }

  if (result.keptHtml) {
    note(
      ctx.report.notes,
      'A table or an embed in a text stays as HTML, because Markdown has no form for it.'
    )
  }

  return localizeLinks(result.markdown, ctx.baseUrl)
}

function localizeLinks(markdown: string, base: string): string {
  if (!base) {
    return markdown
  }

  const origin = new URL(base).origin

  return markdown.replace(/\]\(([^)\s]*)\)/g, (match, url: string) => {
    if (!url.startsWith(origin)) {
      return match
    }

    return `](${localUrl(url, base)})`
  })
}

function levelOf(value: unknown, fallback: number): string {
  const level = /^h([1-6])$/i.exec(text(value) ?? '')?.[1]

  return level ?? String(fallback)
}

const heading: Handler = (ctx, s) => {
  const title = text(s.title)

  if (!title) {
    return []
  }

  const tag = (text(s.header_size) ?? 'h2').toLowerCase()
  const link = linkOf(s.link, ctx.baseUrl)
  const inline = htmlToInline(title)
  const body = link ? `[${inline}](${link.url})` : inline

  readTypography(ctx, s)

  if (!/^h[1-6]$/.test(tag)) {
    return [
      node(
        'block-text',
        {
          size: snapFontSize(ctx, 'text', s, TEXT_SCALE),
          align: alignOf(s.align),
          color: colorOf(ctx, s, 'title_color'),
        },
        { text: body }
      ),
    ]
  }

  const level = Number(tag.slice(1))

  return [
    node(
      'block-heading',
      {
        level: String(level),
        size: snapFontSize(ctx, 'heading', s, [
          ['', HEADING_DEFAULTS[level] ?? 16],
          ...HEADING_SCALE,
        ]),
        align: alignOf(s.align),
        color: colorOf(ctx, s, 'title_color'),
      },
      { text: body }
    ),
  ]
}

const textEditor: Handler = (ctx, s) => {
  const markdown = richText(ctx, s.editor)

  if (!markdown) {
    return []
  }

  readTypography(ctx, s)

  return [
    node(
      'block-text',
      {
        size: snapFontSize(ctx, 'text', s, TEXT_SCALE),
        align: alignOf(s.align),
        color: colorOf(ctx, s, 'text_color'),
      },
      { text: markdown }
    ),
  ]
}

function imageNode(
  ctx: ConvertContext,
  image: { url: string; alt: string },
  extra: BlockNode['props'] = {}
): BlockNode {
  if (!image.alt) {
    ctx.report.missingAlt++
  }

  return node('block-image', { src: image.url, alt: image.alt, ...extra })
}

const imageWidget: Handler = (ctx, s) => {
  const image = imageOf(ctx, s.image)

  if (!image) {
    note(ctx.report.notes, 'An image widget with no image was skipped.')

    return []
  }

  const linkTo = text(s.link_to)
  const link =
    linkTo === 'custom'
      ? linkOf(s.link, ctx.baseUrl)
      : linkTo === 'file'
        ? { url: image.url, target: undefined }
        : undefined

  return [
    imageNode(ctx, image, {
      caption:
        text(s.caption_source) === 'custom' ? text(s.caption) : undefined,
      width: lengthOf(s.width),
      radius: radiusOf(ctx, s, 'image_border_radius'),
      align: alignOf(s.align),
      link: link?.url,
      target: link?.target,
    }),
  ]
}

const BUTTON_SIZES: Record<string, string> = {
  xs: 'sm',
  sm: 'md',
  md: 'md',
  lg: 'lg',
  xl: 'lg',
}

const button: Handler = (ctx, s) => {
  const link = linkOf(s.link, ctx.baseUrl)
  const size = BUTTON_SIZES[text(s.size) ?? 'sm']
  const background = colorOf(ctx, s, 'background_color')
  const border = text(s.border_border)
    ? colorOf(ctx, s, 'border_color')
    : undefined
  const outline = !background && border !== undefined
  const align = text(s.align)
  const iconValue = (s.selected_icon as { value?: unknown } | undefined)?.value

  return [
    node('block-button', {
      label: text(s.text) ?? 'Click here',
      link: link?.url,
      target: link?.target,
      variant: outline ? 'outline' : undefined,
      size: size === 'md' ? undefined : size,
      align: align === 'justify' ? undefined : alignOf(align),
      full: align === 'justify' ? true : undefined,
      color: outline ? border : background,
      icon:
        typeof iconValue === 'string'
          ? iconProp(ctx, iconValue, 'button')
          : undefined,
    }),
  ]
}

const icon: Handler = (ctx, s) => {
  const link = linkOf(s.link, ctx.baseUrl)
  const px = pxOf(s.size) ?? 50
  const size = nearest(px, ICON_SCALE)

  if (!size.exact) {
    note(ctx.report.roundings, `icon size: ${px}px became ${size.token}`)
  }

  if (text(s.view) && text(s.view) !== 'default') {
    ctx.report.ignoredStyles['icon frame'] =
      (ctx.report.ignoredStyles['icon frame'] ?? 0) + 1
  }

  return [
    node('block-icon', {
      icon: iconProp(ctx, s.selected_icon, 'icon'),
      size: size.token,
      color: colorOf(ctx, s, 'primary_color'),
      align: alignOf(s.align),
      link: link?.url,
      target: link?.target,
      label: link ? 'Link' : undefined,
    }),
  ]
}

const iconList: Handler = (ctx, s) => {
  const items = listOf(s.icon_list).filter((item) => text(item.text))

  if (items.length === 0) {
    return []
  }

  const icons = items.map((item) =>
    item.selected_icon
      ? iconProp(ctx, item.selected_icon, 'icon list')
      : 'i-lucide-check'
  )
  const counts = new Map<string, number>()

  for (const entry of icons) {
    counts.set(entry, (counts.get(entry) ?? 0) + 1)
  }

  const common = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0]
  const space = pxOf(s.space_between)

  return [
    node(
      'block-icon-list',
      {
        icon: common === 'i-lucide-check' ? undefined : common,
        color: colorOf(ctx, s, 'icon_color'),
        gap:
          space === undefined
            ? undefined
            : snapSpace(ctx, 'icon list gap', space),
        layout: text(s.view) === 'inline' ? 'inline' : undefined,
      },
      {
        children: items.map((item, index) => {
          const link = linkOf(item.link, ctx.baseUrl)
          const own = icons[index]

          return node(
            'block-icon-list-item',
            {
              icon: own === common ? undefined : own,
              link: link?.url,
              target: link?.target,
            },
            { text: inlineOf(item.text) }
          )
        }),
      }
    ),
  ]
}

function positionOf(ctx: ConvertContext, value: unknown): string | undefined {
  const position = text(value)

  if (position === 'right') {
    note(
      ctx.report.notes,
      'An image or icon on the right moved to the left of its text.'
    )

    return 'left'
  }

  return position === 'left' ? 'left' : undefined
}

const iconBox: Handler = (ctx, s) => {
  const link = linkOf(s.link, ctx.baseUrl)
  const position = positionOf(ctx, s.position)

  return [
    node(
      'block-icon-box',
      {
        icon: iconProp(ctx, s.selected_icon, 'icon box'),
        title: plainOf(s.title_text) || undefined,
        level:
          levelOf(s.title_size, 3) === '3'
            ? undefined
            : levelOf(s.title_size, 3),
        link: link?.url,
        target: link?.target,
        position,
        align: position ? undefined : alignOf(s.text_align),
        color: colorOf(ctx, s, 'primary_color'),
      },
      { text: richText(ctx, s.description_text) }
    ),
  ]
}

const imageBox: Handler = (ctx, s) => {
  const image = imageOf(ctx, s.image)
  const link = linkOf(s.link, ctx.baseUrl)
  const position = positionOf(ctx, s.position)
  const title = plainOf(s.title_text)

  if (image && !image.alt && !title) {
    ctx.report.missingAlt++
  }

  return [
    node(
      'block-image-box',
      {
        src: image?.url,
        alt: image?.alt || title,
        title: title || undefined,
        level:
          levelOf(s.title_size, 3) === '3'
            ? undefined
            : levelOf(s.title_size, 3),
        link: link?.url,
        target: link?.target,
        position,
        align: position ? undefined : alignOf(s.text_align),
        radius: radiusOf(ctx, s, 'image_border_radius'),
      },
      { text: richText(ctx, s.description_text) }
    ),
  ]
}

function accordionWidget(single: boolean): Handler {
  return (ctx, s) => {
    const tabs = listOf(s.tabs).filter((tab) => text(tab.tab_title))

    if (tabs.length === 0) {
      return []
    }

    return [
      node(
        'block-accordion',
        { single: single ? true : undefined },
        {
          children: tabs.map((tab) =>
            node(
              'block-accordion-item',
              { title: plainOf(tab.tab_title) },
              { text: richText(ctx, tab.tab_content) }
            )
          ),
        }
      ),
    ]
  }
}

const testimonial: Handler = (ctx, s) => {
  const image = imageOf(ctx, s.testimonial_image)
  const align = alignOf(s.testimonial_alignment)

  return [
    node(
      'block-testimonial',
      {
        name: plainOf(s.testimonial_name) || undefined,
        role: plainOf(s.testimonial_job) || undefined,
        image: image?.url,
        align: align === 'center' ? 'center' : undefined,
      },
      { text: richText(ctx, s.testimonial_content) }
    ),
  ]
}

const counter: Handler = (ctx, s) => {
  const value = numberOf(String(s.ending_number ?? '').replace(/,/g, ''))

  if (value === undefined) {
    return placeholder(
      ctx,
      'counter with a value that is not a number',
      'a counter with a value that is not a number'
    )
  }

  return [
    node('block-counter', {
      value,
      prefix: text(s.prefix),
      suffix: text(s.suffix),
      title: plainOf(s.title) || undefined,
      color: colorOf(ctx, s, 'number_color'),
    }),
  ]
}

const SHAPES: Record<string, string> = {
  rounded: 'square',
  square: 'square',
  circle: 'circle',
}

const socialIcons: Handler = (ctx, s) => {
  const links = listOf(s.social_icon_list)
    .map((item) => ({ item, link: linkOf(item.link, ctx.baseUrl) }))
    .filter((entry) => entry.link)

  if (links.length === 0) {
    return []
  }

  const custom = text(s.icon_color) === 'custom'

  return [
    node(
      'block-social-icons',
      {
        shape: SHAPES[text(s.shape) ?? 'rounded'],
        align: alignOf(s.align),
        color: custom ? colorOf(ctx, s, 'icon_primary_color') : undefined,
      },
      {
        children: links.map(({ item, link }) => {
          const network = networkOf(item.social_icon)

          if (!network) {
            const result = mapIcon(item.social_icon)

            note(ctx.report.unmappedIcons, `${result.source} (social icons)`)

            return node('block-social-link', {
              network: 'website',
              url: link!.url,
              icon: DEFAULT_ICON,
            })
          }

          return node('block-social-link', { network, url: link!.url })
        }),
      }
    ),
  ]
}

const gallery: Handler = (ctx, s) => {
  const source = listOf(s.wp_gallery).length > 0 ? s.wp_gallery : s.gallery
  const images = listOf(source)
    .map((item) => imageOf(ctx, item))
    .filter((image): image is { url: string; alt: string } => Boolean(image))

  if (images.length === 0) {
    return []
  }

  const columns = numberOf(s.gallery_columns) ?? numberOf(s.columns) ?? 4

  return [
    node(
      'block-gallery',
      { columns: Math.min(Math.max(columns, 1), 6) },
      { children: images.map((image) => imageNode(ctx, image)) }
    ),
  ]
}

const RATIOS: Record<string, string> = {
  169: '16:9',
  43: '4:3',
  11: '1:1',
  219: '21:9',
  916: '9:16',
}

const video: Handler = (ctx, s) => {
  const type = text(s.video_type) ?? 'youtube'
  const url =
    type === 'youtube'
      ? text(s.youtube_url)
      : type === 'vimeo'
        ? text(s.vimeo_url)
        : type === 'dailymotion'
          ? text(s.dailymotion_url)
          : text((s.hosted_url as { url?: unknown } | undefined)?.url)

  if (!url) {
    return []
  }

  if (type !== 'youtube' && type !== 'vimeo') {
    note(
      ctx.report.notes,
      `A ${type} video renders as a link, because only YouTube and Vimeo have an embed.`
    )
  }

  const ratio = RATIOS[text(s.aspect_ratio) ?? '169']

  return [
    node('block-video', {
      url: absoluteUrl(url, ctx.baseUrl),
      ratio: ratio === '16:9' ? undefined : ratio,
    }),
  ]
}

const divider: Handler = (ctx, s) => {
  const style = text(s.style)
  const gap = pxOf(s.gap)

  return [
    node('block-divider', {
      line: style === 'dashed' || style === 'dotted' ? style : undefined,
      color: colorOf(ctx, s, 'color'),
      thickness: pxOf(s.weight),
      width: lengthOf(s.width),
      align: alignOf(s.align),
      spacing:
        gap === undefined ? undefined : snapSpace(ctx, 'divider gap', gap),
    }),
  ]
}

const spacer: Handler = (_ctx, s) => [
  node('block-spacer', { size: lengthOf(s.space) ?? '50px' }),
]

const htmlWidget: Handler = (ctx, s) => {
  const html = text(s.html)

  if (!html) {
    return []
  }

  const label = html.replace(/\s+/g, ' ').slice(0, 48)

  ctx.report.rawHtml.push(
    DANGEROUS_HTML.test(html)
      ? `${label} (has a script, an iframe, a form or a style: the renderer removes it)`
      : label
  )

  return [node(RAW_HTML, {}, { text: html })]
}

const shortcode: Handler = (ctx, s) => {
  const code = text(s.shortcode) ?? ''

  note(ctx.report.shortcodes, code)

  return placeholder(ctx, `shortcode ${code}`, `the shortcode \`${code}\``)
}

const HANDLERS: Record<string, Handler> = {
  heading,
  'text-editor': textEditor,
  image: imageWidget,
  button,
  icon,
  'icon-list': iconList,
  'icon-box': iconBox,
  'image-box': imageBox,
  accordion: accordionWidget(true),
  toggle: accordionWidget(false),
  testimonial,
  counter,
  'social-icons': socialIcons,
  'image-gallery': gallery,
  gallery,
  video,
  divider,
  spacer,
  html: htmlWidget,
  shortcode,
}

const SILENT = new Set(['menu-anchor'])

/** The block names this importer writes. */
export const WIDGET_TYPES = Object.keys(HANDLERS)

export function widgetNodes(
  ctx: ConvertContext,
  element: ElementorElement
): BlockNode[] {
  const type = element.widgetType ?? ''
  const handler = HANDLERS[type]

  if (handler) {
    return handler(ctx, element.settings ?? {})
  }

  ctx.report.unknownWidgets[type] = (ctx.report.unknownWidgets[type] ?? 0) + 1

  if (SILENT.has(type)) {
    return []
  }

  return placeholder(
    ctx,
    `widget ${type || 'without a name'}`,
    `the Elementor widget "${type || 'without a name'}"`
  )
}
