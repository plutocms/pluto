// The text of the sitemap, the feed and robots.txt. Pure code with no Nuxt import, so plain
// Vitest tests it. The handlers in `server/handlers/` fetch the data and call these functions.

/** The most URLs of one sitemap file (the limit of the sitemap protocol). */
export const PLUTO_SEO_SITEMAP_MAX = 50_000

/** The most items of the feed. */
export const PLUTO_SEO_FEED_MAX = 100

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

// The characters that XML 1.0 does not allow (control characters, except tab, LF and CR).
// eslint-disable-next-line no-control-regex
const INVALID_XML = /[\u0000-\u0008\v\f\u000E-\u001F\uFFFE\uFFFF]/g

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8"?>'

/** Escapes text for an XML element or attribute, and drops the characters that XML does not allow. */
export function plutoSeoEscapeXml(value: string): string {
  return value
    .replace(INVALID_XML, '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}

/** A date as RFC 822 in GMT (`Tue, 03 Nov 2026 10:00:00 GMT`), for RSS. `''` for a bad date. */
export function plutoSeoRfc822(value: unknown): string {
  const date = toDate(value)
  if (!date) {
    return ''
  }
  const pad = (number: number) => String(number).padStart(2, '0')
  return `${DAYS[date.getUTCDay()]}, ${pad(date.getUTCDate())} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} GMT`
}

export interface PlutoSeoSitemapUrl {
  /** The absolute URL. */
  loc: string
  /** A date, as the store gives it. A bad date is left out. */
  lastmod?: unknown
}

/** The sitemap XML for these URLs. It keeps the first 50,000. An empty list gives an empty `urlset`. */
export function plutoSeoRenderSitemap(urls: PlutoSeoSitemapUrl[]): string {
  const lines = urls.slice(0, PLUTO_SEO_SITEMAP_MAX).map((url) => {
    const lastmod = toDate(url.lastmod)
    return [
      '  <url>',
      `    <loc>${plutoSeoEscapeXml(url.loc)}</loc>`,
      ...(lastmod ? [`    <lastmod>${lastmod.toISOString()}</lastmod>`] : []),
      '  </url>',
    ].join('\n')
  })
  return [
    XML_HEAD,
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...lines,
    '</urlset>',
    '',
  ].join('\n')
}

export interface PlutoSeoFeedChannel {
  title: string
  /** The absolute URL of the site. Empty when the site URL is not known. */
  link: string
  description: string
  /** The language code, for example `pt-BR`. Empty: none. */
  language?: string
  /** The absolute URL of the feed itself. Empty: no `atom:link`. */
  selfLink?: string
  lastBuildDate?: unknown
}

export interface PlutoSeoFeedItem {
  title: string
  /** The absolute URL of the page. */
  link: string
  /** The date of the first publish. */
  pubDate?: unknown
  /** Plain text. The renderer escapes it. */
  description: string
  /** The names of the authors (`dc:creator`), for example "Ana, Bo". Plain text. */
  creator?: string
}

/** The RSS 2.0 feed XML. The items are as the caller sorts them. It keeps the first 100. */
export function plutoSeoRenderRss(
  channel: PlutoSeoFeedChannel,
  items: PlutoSeoFeedItem[]
): string {
  const text = (tag: string, value: string, indent = '    ') =>
    `${indent}<${tag}>${plutoSeoEscapeXml(value)}</${tag}>`
  const lastBuild = plutoSeoRfc822(channel.lastBuildDate)
  const lines = items.slice(0, PLUTO_SEO_FEED_MAX).map((item) => {
    const pubDate = plutoSeoRfc822(item.pubDate)
    return [
      '    <item>',
      text('title', item.title, '      '),
      text('link', item.link, '      '),
      `      <guid isPermaLink="true">${plutoSeoEscapeXml(item.link)}</guid>`,
      ...(pubDate ? [`      <pubDate>${pubDate}</pubDate>`] : []),
      text('description', item.description, '      '),
      ...(item.creator ? [text('dc:creator', item.creator, '      ')] : []),
      '    </item>',
    ].join('\n')
  })
  return [
    XML_HEAD,
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    '  <channel>',
    text('title', channel.title),
    text('link', channel.link),
    text('description', channel.description),
    ...(channel.language ? [text('language', channel.language)] : []),
    ...(channel.selfLink
      ? [
          `    <atom:link href="${plutoSeoEscapeXml(channel.selfLink)}" rel="self" type="application/rss+xml" />`,
        ]
      : []),
    ...(lastBuild ? [`    <lastBuildDate>${lastBuild}</lastBuildDate>`] : []),
    ...lines,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')
}

export interface PlutoSeoRobotsOptions {
  /** False: the whole site is disallowed (a staging site), and no sitemap is named. */
  indexable: boolean
  /** The base path of the site (`/`, or `/repo/`). It goes in front of each disallowed path. */
  baseURL?: string
  /** Site paths to disallow, without the base path. */
  disallow: string[]
  /** The absolute URL of the sitemap. Empty: no `Sitemap:` line. */
  sitemap?: string
}

/** The paths that robots.txt always disallows: the admin, the API of the admin, the preview pages. */
export const PLUTO_SEO_ROBOTS_DISALLOW = ['/admin', '/api/_pluto', '/_pluto']

/** The robots.txt text. */
export function plutoSeoRenderRobots(options: PlutoSeoRobotsOptions): string {
  const lines = ['User-agent: *']
  if (!options.indexable) {
    lines.push('Disallow: /')
    return `${lines.join('\n')}\n`
  }
  const base = (options.baseURL ?? '').replace(/^\/+|\/+$/g, '')
  const prefix = base ? `/${base}` : ''
  const paths = [...PLUTO_SEO_ROBOTS_DISALLOW, ...options.disallow]
  const seen = new Set<string>()
  for (const path of paths) {
    const value = `${prefix}/${path.trim().replace(/^\/+/, '')}`
    if (path.trim() && !seen.has(value)) {
      seen.add(value)
      lines.push(`Disallow: ${value}`)
    }
  }
  if (options.sitemap) {
    lines.push('', `Sitemap: ${options.sitemap}`)
  }
  return `${lines.join('\n')}\n`
}
