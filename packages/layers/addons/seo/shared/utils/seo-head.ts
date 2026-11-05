// What the head tags of a page say. Pure code with no Nuxt import, so plain Vitest tests it. The
// composable `usePlutoSeo` and the plugin of the layer turn these values into head entries.

import type { PlutoSeoConfig } from '../types/seo'

/** The longest description for a search result. */
export const PLUTO_SEO_DESCRIPTION_MAX = 160

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : undefined
}

/** Cuts a text to `max` characters at a word end, with an ellipsis. A shorter text stays. */
export function plutoSeoCutText(value: string, max: number): string {
  if (value.length <= max) {
    return value
  }
  let cut = value.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  if (space > max * 0.6) {
    cut = cut.slice(0, space)
  }
  return `${cut.trimEnd().replace(/[.,;:!?-]+$/, '')}…`
}

/**
 * The plain text of an HTML string: the tags go, the common entities decode, the white space
 * collapses. With `max`, a longer text is cut at a word end and gets an ellipsis.
 */
export function plutoSeoPlainText(html: string, max?: number): string {
  const plain = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(
      /&(?:amp|lt|gt|quot|apos|nbsp|#39);/g,
      (entity) => ENTITIES[entity]!
    )
    .replace(/\s+/g, ' ')
    .trim()
  return max === undefined ? plain : plutoSeoCutText(plain, max)
}

/**
 * The description of an item: `seoDescription`, else `excerpt`, else `description`, else the plain
 * text of `html` cut at 160. `undefined` when the item has none.
 */
export function plutoSeoDescription(
  item: Record<string, unknown> | null | undefined
): string | undefined {
  if (!item) {
    return undefined
  }
  const own =
    text(item.seoDescription) ?? text(item.excerpt) ?? text(item.description)
  if (own) {
    return own
  }
  const html = typeof item.html === 'string' ? item.html : ''
  return plutoSeoPlainText(html, PLUTO_SEO_DESCRIPTION_MAX) || undefined
}

export interface PlutoSeoImage {
  /** The absolute URL. */
  url: string
  alt?: string
  width?: number
  height?: number
}

/** The record of a `media` field (or the first of a list) as an image, with an absolute URL. */
function imageOf(
  value: unknown,
  absoluteUrl: (path: string) => string
): PlutoSeoImage | undefined {
  const record = (Array.isArray(value) ? value[0] : value) as
    Record<string, unknown> | null | undefined
  const url =
    record && typeof record === 'object' ? text(record.url) : undefined
  const absolute = url ? absoluteUrl(url) : ''
  if (!absolute) {
    return undefined
  }
  const alt = text(record!.alt)
  return {
    url: absolute,
    ...(alt && { alt }),
    ...(typeof record!.width === 'number' && { width: record!.width }),
    ...(typeof record!.height === 'number' && { height: record!.height }),
  }
}

export interface PlutoSeoItemContext {
  /** The content type, with the extensions applied. */
  type?: PlutoContentType
  /** The default share image of the site (`plutoSeo.image`): a site path or a full URL. */
  defaultImage?: string
  /** Gives the absolute URL of a site path, or `''` when the site root is not known. */
  absoluteUrl: (path: string) => string
}

export interface PlutoSeoItemHead {
  title?: string
  description?: string
  image?: PlutoSeoImage
  noindex: boolean
  /** ISO time of the first publish. */
  publishedTime?: string
  /** ISO time of the last change. */
  modifiedTime?: string
}

/**
 * What the head of an item page says. The title is `seoTitle`, else the title field. The
 * description is `plutoSeoDescription`. The image is `seoImage`, else `cover`, else the first
 * `media` field with a file, else the default image of the site; it is absolute, and it has the
 * alt text and the size when the media record has them.
 */
export function plutoSeoItemHead(
  item: Record<string, unknown> | null | undefined,
  context: PlutoSeoItemContext
): PlutoSeoItemHead {
  if (!item) {
    return { noindex: false }
  }
  const { type, absoluteUrl } = context

  const mediaNames = (type?.fields ?? [])
    .filter((field) => field.type === 'media' && field.name !== 'seoImage')
    .map((field) => field.name)
  let image = imageOf(item.seoImage, absoluteUrl)
  for (const name of ['cover', ...mediaNames]) {
    image ??= imageOf(item[name], absoluteUrl)
  }
  if (!image && context.defaultImage) {
    const url = absoluteUrl(context.defaultImage)
    image = url ? { url } : undefined
  }

  return {
    title: text(item.seoTitle) ?? text(item[type?.titleField ?? 'title']),
    description: plutoSeoDescription(item),
    image,
    noindex: item.seoNoindex === true,
    publishedTime: text(item.publishedAt),
    modifiedTime: text(item.updatedAt),
  }
}

/**
 * The path of the canonical URL: the path of the page, plus `?page=N` when `page` is a whole
 * number above 1 (a page of a list). Any other query is left out.
 */
export function plutoSeoCanonicalPath(
  path: string,
  page?: string | string[] | null
): string {
  const value = Array.isArray(page) ? page[0] : page
  const number =
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : 1
  return number > 1 ? `${path}?page=${number}` : path
}

/** True for a path that gets no site-wide tags: the admin, the API of the admin, the preview pages. */
export function plutoSeoIsPrivatePath(path: string): boolean {
  return /^\/(?:admin|_pluto|api\/_pluto)(?:\/|$)/.test(path)
}

export interface PlutoSeoSiteHeadInput {
  /** The path of the page, without the base path and without a query. */
  path: string
  /** The `page` query of the page, for a list. */
  page?: string | string[] | null
  /** The error page is showing. */
  error?: boolean
  config: Pick<PlutoSeoConfig, 'image' | 'twitterSite' | 'indexable' | 'feed'>
  /** Gives the absolute URL of a site path, or `''` when the site root is not known. */
  absoluteUrl: (path: string) => string
  /** The name of the site, or `''`. */
  siteName?: string
  /** The feed type is a public content type, so `/feed.xml` has items. */
  hasFeed?: boolean
  /** The base path of the app (`/`, or `/repo/`), for the feed link when the site root is not known. */
  baseURL?: string
}

type HeadTags = Record<string, string>[]

/**
 * The tags of every public page: the canonical URL and `og:url` (with a known site root), the
 * default `twitter:card` and `og:image`, `twitter:site`, the feed link, and `noindex` for a site
 * that is not indexable. A page that sets its own tags overrides them, because its entry is
 * later. The admin, the preview pages and the error page get none.
 */
export function plutoSeoSiteHead(input: PlutoSeoSiteHeadInput): {
  link: HeadTags
  meta: HeadTags
} {
  if (input.error || plutoSeoIsPrivatePath(input.path)) {
    return { link: [], meta: [] }
  }
  const { config, absoluteUrl } = input
  const canonical = absoluteUrl(plutoSeoCanonicalPath(input.path, input.page))
  const image = config.image ? absoluteUrl(config.image) : ''
  const feedUrl =
    absoluteUrl('/feed.xml') ||
    `${(input.baseURL ?? '/').replace(/\/+$/, '')}/feed.xml`

  const link: (Record<string, string> | false)[] = [
    !!canonical && { rel: 'canonical', href: canonical },
    !!input.hasFeed && {
      rel: 'alternate',
      type: 'application/rss+xml',
      title: input.siteName || 'RSS',
      href: feedUrl,
    },
  ]
  const meta: (Record<string, string> | false)[] = [
    !!canonical && { property: 'og:url', content: canonical },
    !!input.siteName && { property: 'og:site_name', content: input.siteName },
    {
      name: 'twitter:card',
      content: image ? 'summary_large_image' : 'summary',
    },
    !!config.twitterSite && {
      name: 'twitter:site',
      content: config.twitterSite,
    },
    !!image && { property: 'og:image', content: image },
    !!image && { name: 'twitter:image', content: image },
    config.indexable === false && {
      name: 'robots',
      content: 'noindex, nofollow',
    },
  ]
  return {
    link: link.filter((tag): tag is Record<string, string> => !!tag),
    meta: meta.filter((tag): tag is Record<string, string> => !!tag),
  }
}
