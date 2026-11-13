import {
  PLUTO_SEO_DESCRIPTION_MAX,
  plutoSeoCutText,
  plutoSeoPlainText,
} from './seo-head'

/** The longest title that a search result shows before it cuts the title. */
export const PLUTO_SEO_TITLE_MAX = 60

type Item = Record<string, unknown>

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : undefined
}

/** The text of a Markdown string without its marks (headings, emphasis, links, code, images). */
export function plutoSeoMarkdownText(markdown: string): string {
  return plutoSeoPlainText(
    markdown
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^\s{0,3}(?:#{1,6}|[>\-*+]|\d+\.)\s+/gm, '')
      .replace(/[*_`~]+/g, '')
  )
}

/**
 * The title and the description that the page will say, from the item of the form: the SEO
 * value, else the title field, else the excerpt, else the start of the body. The body is the
 * first `richtext` field. Both are `''` while the item has none.
 */
export function plutoSeoPreviewText(
  item: Item,
  type?: PlutoContentType
): { title: string; description: string } {
  const body = type?.fields.find(
    (field) => field.type === 'richtext' && !field.virtual
  )
  const bodyValue = body ? text(item[body.name]) : undefined
  const bodyText = bodyValue
    ? plutoSeoCutText(
        plutoSeoMarkdownText(bodyValue),
        PLUTO_SEO_DESCRIPTION_MAX
      )
    : ''
  return {
    title: text(item.seoTitle) ?? text(item[type?.titleField ?? 'title']) ?? '',
    description:
      text(item.seoDescription) ??
      text(item.excerpt) ??
      text(item.description) ??
      bodyText,
  }
}

function firstId(value: unknown): string | undefined {
  const id = Array.isArray(value) ? value[0] : value
  return typeof id === 'string' && id !== '' ? id : undefined
}

/**
 * The media id of the social image: `seoImage`, else `cover`, else the first `media` field with a
 * file. `undefined` when the item has none.
 */
export function plutoSeoPreviewImageId(
  item: Item,
  type?: PlutoContentType
): string | undefined {
  const names = (type?.fields ?? [])
    .filter((field) => field.type === 'media' && field.name !== 'seoImage')
    .map((field) => field.name)
  for (const name of ['seoImage', 'cover', ...names]) {
    const id = firstId(item[name])
    if (id) {
      return id
    }
  }
  return undefined
}

export interface PlutoSeoCount {
  length: number
  max: number
  /** The text is longer than a search result shows. */
  over: boolean
}

/** The length of a text against a limit. */
export function plutoSeoCount(value: string, max: number): PlutoSeoCount {
  return { length: value.length, max, over: value.length > max }
}

export interface PlutoSeoSearchCard {
  /** The host, or `''` while the site URL is not known. */
  host: string
  /** The path segments, for the breadcrumb under the host. */
  segments: string[]
  /** The title as a search result shows it: cut at 60. */
  title: string
  /** The description as a search result shows it: cut at 160. */
  description: string
  titleCount: PlutoSeoCount
  descriptionCount: PlutoSeoCount
}

/**
 * The search result card. `url` is the absolute URL of the page, or `''` (a draft, a new item, or
 * an unknown site URL): then the card has no host and no path.
 */
export function plutoSeoSearchCard(input: {
  title: string
  description: string
  url: string
}): PlutoSeoSearchCard {
  let host = ''
  let segments: string[] = []
  try {
    const url = new URL(input.url)
    host = url.host
    segments = url.pathname.split('/').filter(Boolean)
  } catch {
    // No usable URL: the card shows the title and the description only.
  }
  return {
    host,
    segments,
    title: plutoSeoCutText(input.title, PLUTO_SEO_TITLE_MAX),
    description: plutoSeoCutText(input.description, PLUTO_SEO_DESCRIPTION_MAX),
    titleCount: plutoSeoCount(input.title, PLUTO_SEO_TITLE_MAX),
    descriptionCount: plutoSeoCount(
      input.description,
      PLUTO_SEO_DESCRIPTION_MAX
    ),
  }
}
