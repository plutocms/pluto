import { ELEMENT_NODE, parse, renderSync, TEXT_NODE } from 'ultrahtml'
import { decodeEntitiesOnce } from '../markdown/sanitize-html'

/**
 * Embeds: a paragraph of the body that is one URL alone (the renderer marks it with
 * `data-pluto-embed`, see `isEmbedParagraph` in shared/markdown/render.ts) shows as the player of
 * the first provider that matches the URL. The providers are in the `embedProviders` bucket of
 * the registry; core has YouTube and Vimeo. A provider matches the URL itself, with strict hosts
 * and id patterns, and its component gets only what the match returns. See the content-model
 * skill ("Embeds"). Pure: no DOM, no Nuxt.
 */

/** The data that a provider takes from a URL: the id and the options, as text. */
export type PlutoEmbedMatch = Record<string, string>

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
])
const YOUTUBE_ID = /^[\w-]{11}$/

/** Seconds from `90`, `90s` or `1h2m3s`. `undefined` when it is not a time. */
function youtubeSeconds(value: string | null): number | undefined {
  if (!value) {
    return undefined
  }
  if (/^\d+s?$/.test(value)) {
    return Number.parseInt(value, 10)
  }
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value)
  if (!match || !match[0]) {
    return undefined
  }
  const [, hours = '0', minutes = '0', seconds = '0'] = match
  return (
    Number.parseInt(hours, 10) * 3600 +
    Number.parseInt(minutes, 10) * 60 +
    Number.parseInt(seconds, 10)
  )
}

/**
 * A YouTube video: `youtube.com/watch?v=<id>`, `/shorts/<id>`, `/embed/<id>`, `/live/<id>`,
 * `youtu.be/<id>`. The id has 11 characters. `t` or `start` gives `start` (seconds).
 */
export function matchYoutubeUrl(url: URL): PlutoEmbedMatch | null {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return null
  }
  const host = url.hostname.toLowerCase()
  let id: string | undefined
  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1]
  } else if (YOUTUBE_HOSTS.has(host)) {
    const [first, second] = url.pathname.split('/').slice(1)
    if (first === 'watch') {
      id = url.searchParams.get('v') ?? undefined
    } else if (
      first === 'shorts' ||
      first === 'embed' ||
      first === 'live' ||
      first === 'v'
    ) {
      id = second
    }
  }
  if (!id || !YOUTUBE_ID.test(id)) {
    return null
  }
  const start = youtubeSeconds(
    url.searchParams.get('t') ?? url.searchParams.get('start')
  )
  return start ? { id, start: String(start) } : { id }
}

/**
 * A Vimeo video: `vimeo.com/<id>`, `vimeo.com/<id>/<hash>` (an unlisted video),
 * `vimeo.com/channels/<name>/<id>`, `player.vimeo.com/video/<id>?h=<hash>`. The id is digits.
 */
export function matchVimeoUrl(url: URL): PlutoEmbedMatch | null {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return null
  }
  const host = url.hostname.toLowerCase()
  const parts = url.pathname.split('/').filter(Boolean)
  let id: string | undefined
  let hash: string | undefined
  if (host === 'player.vimeo.com' && parts[0] === 'video') {
    id = parts[1]
    hash = url.searchParams.get('h') ?? undefined
  } else if (host === 'vimeo.com' || host === 'www.vimeo.com') {
    if (parts[0] === 'channels' && parts.length >= 3) {
      id = parts[2]
    } else {
      id = parts[0]
      hash = parts[1]
    }
  }
  if (!id || !/^\d{1,12}$/.test(id)) {
    return null
  }
  return hash && /^[\da-f]{6,20}$/i.test(hash) ? { id, hash } : { id }
}

/** A piece of the body for `PlutoHtml`: an element with its inner HTML, or an embed paragraph. */
export type PlutoHtmlPart =
  | {
      kind: 'element'
      tag: string
      attrs: Record<string, string>
      inner: string
    }
  | { kind: 'text'; text: string }
  | { kind: 'embed'; href: string; inner: string }

/** Decodes the entities that the sanitizer writes in a text or an attribute value. */
export const decodeHtmlEntities = decodeEntitiesOnce

interface HtmlNode {
  type: number
  name?: string
  value?: string
  attributes?: Record<string, string>
  children?: HtmlNode[]
}

/** The first `a` with an `href` under a node. */
function firstHref(node: HtmlNode): string | undefined {
  for (const child of node.children ?? []) {
    if (child.type === ELEMENT_NODE && child.name === 'a') {
      return child.attributes?.href
    }
    const found = firstHref(child)
    if (found) {
      return found
    }
  }
  return undefined
}

/** True when the HTML has an embed paragraph. A quick test before `splitEmbedHtml`. */
export function hasEmbedParagraph(html: string): boolean {
  return html.includes('data-pluto-embed')
}

/**
 * Splits sanitized body HTML into its top-level parts, so `PlutoHtml` can put a provider
 * component in place of an embed paragraph and keep every other element as it is (its inner HTML
 * stays a string). The top level stays flat, so the direct-child rules of `.pluto-prose` still
 * apply. Whitespace between the elements goes.
 */
export function splitEmbedHtml(html: string): PlutoHtmlPart[] {
  const root = parse(html) as HtmlNode
  const parts: PlutoHtmlPart[] = []
  for (const node of root.children ?? []) {
    if (node.type === TEXT_NODE) {
      const text = decodeHtmlEntities(node.value ?? '')
      if (text.trim()) {
        parts.push({ kind: 'text', text })
      }
      continue
    }
    if (node.type !== ELEMENT_NODE || !node.name) {
      continue
    }
    const inner = (node.children ?? [])
      .map((child) => renderSync(child as never))
      .join('')
    const attributes = node.attributes ?? {}
    const href = firstHref(node)
    if (node.name === 'p' && 'data-pluto-embed' in attributes && href) {
      parts.push({ kind: 'embed', href: decodeHtmlEntities(href), inner })
      continue
    }
    parts.push({
      kind: 'element',
      tag: node.name,
      attrs: Object.fromEntries(
        Object.entries(attributes).map(([key, value]) => [
          key,
          decodeHtmlEntities(String(value)),
        ])
      ),
      inner,
    })
  }
  return parts
}

/** The first provider (by `order`) that matches `href`, with its match. `null` for none. */
export function resolveEmbed<
  P extends { match: (url: URL) => PlutoEmbedMatch | null },
>(
  providers: readonly P[],
  href: string
): { provider: P; match: PlutoEmbedMatch } | null {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return null
  }
  for (const provider of providers) {
    const match = provider.match(url)
    if (match) {
      return { provider, match }
    }
  }
  return null
}
