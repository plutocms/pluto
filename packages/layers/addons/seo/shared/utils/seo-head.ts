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
 * The description of an item: `seoDescription`, else `excerpt`, else `description`, else `bio`
 * (an author page), else the plain text of `html` cut at 160. `undefined` when the item has none.
 */
export function plutoSeoDescription(
  item: Record<string, unknown> | null | undefined
): string | undefined {
  if (!item) {
    return undefined
  }
  const own =
    text(item.seoDescription) ??
    text(item.excerpt) ??
    text(item.description) ??
    text(item.bio)
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

/** An author of an item, for the head and the feed. */
export interface PlutoSeoAuthor {
  name: string
  /** The absolute URL of the author page. */
  url?: string
  /** The absolute URL of the avatar. */
  image?: string
}

const AUTHOR_FIELDS = ['authors', 'author']

/**
 * The authors of an item: the expanded references of its `authors` field (or `author`), in
 * order. The name is `label` (or `name`). `authorUrl` gives the site path of the author page,
 * and the avatar is the `avatar` record. A plain id (an unexpanded reference) is skipped.
 */
export function plutoSeoAuthors(
  item: Record<string, unknown> | null | undefined,
  context: {
    absoluteUrl?: (path: string) => string
    authorUrl?: (author: Record<string, unknown>) => string | undefined
  } = {}
): PlutoSeoAuthor[] {
  const name = AUTHOR_FIELDS.find(
    (key) => item?.[key] !== undefined && item?.[key] !== null
  )
  if (!item || !name) {
    return []
  }
  const value = item[name]
  const entries = (Array.isArray(value) ? value : [value]).filter(
    (entry): entry is Record<string, unknown> =>
      entry !== null && typeof entry === 'object'
  )
  const absolute = context.absoluteUrl ?? (() => '')
  return entries.flatMap((entry) => {
    const label = text(entry.label) ?? text(entry.name)
    if (!label) {
      return []
    }
    const path = context.authorUrl?.(entry)
    const url = path ? absolute(path) : ''
    const avatar = entry.avatar as Record<string, unknown> | null | undefined
    const avatarUrl = avatar && text(avatar.url)
    const image = avatarUrl ? absolute(avatarUrl) : ''
    return [{ name: label, ...(url && { url }), ...(image && { image }) }]
  })
}

/**
 * The site path of an author page, from the `previewUrl` of the target type of the `authors`
 * (or `author`) field of `type`. `typeOf` gives a content type by name.
 */
export function plutoSeoAuthorUrl(
  type: PlutoContentType | undefined,
  typeOf: (name: string) => PlutoContentType | undefined
): ((author: Record<string, unknown>) => string | undefined) | undefined {
  const field = type?.fields.find(
    (entry) => entry.type === 'reference' && AUTHOR_FIELDS.includes(entry.name)
  )
  const target =
    field?.type === 'reference' && field.target
      ? typeOf(field.target)
      : undefined
  const previewUrl = target?.previewUrl
  if (!previewUrl) {
    return undefined
  }
  return (author) => {
    try {
      return previewUrl({ ...author, id: author.id } as PlutoContentItem)
    } catch {
      return undefined
    }
  }
}

export interface PlutoSeoItemContext {
  /** The content type, with the extensions applied. */
  type?: PlutoContentType
  /** Gives a content type by name, for the author page URL. */
  typeOf?: (name: string) => PlutoContentType | undefined
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
  /** The authors, in byline order. */
  authors: PlutoSeoAuthor[]
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
    return { noindex: false, authors: [] }
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
    authors: plutoSeoAuthors(item, {
      absoluteUrl,
      authorUrl: context.typeOf
        ? plutoSeoAuthorUrl(type, context.typeOf)
        : undefined,
    }),
  }
}

/**
 * The JSON-LD of an article page: a schema.org `BlogPosting` with the headline, the description,
 * the image, the dates, the authors (each a `Person`) and the page URL. `undefined` without a
 * title.
 */
export function plutoSeoArticleJsonLd(
  head: PlutoSeoItemHead,
  pageUrl?: string
): Record<string, unknown> | undefined {
  if (!head.title) {
    return undefined
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: head.title,
    ...(head.description && { description: head.description }),
    ...(head.image && { image: [head.image.url] }),
    ...(head.publishedTime && { datePublished: head.publishedTime }),
    ...(head.modifiedTime && { dateModified: head.modifiedTime }),
    ...(head.authors.length > 0 && {
      author: head.authors.map((author) => ({
        '@type': 'Person',
        name: author.name,
        ...(author.url && { url: author.url }),
        ...(author.image && { image: author.image }),
      })),
    }),
    ...(pageUrl && { mainEntityOfPage: pageUrl, url: pageUrl }),
  }
}

/**
 * The text of a JSON-LD script: the JSON, with `<`, `>`, `&` and the line separators escaped, so
 * no value can close the script tag.
 */
export function plutoSeoJsonLdText(data: unknown): string {
  return JSON.stringify(data).replace(
    /[<>&\u2028\u2029]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`
  )
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
