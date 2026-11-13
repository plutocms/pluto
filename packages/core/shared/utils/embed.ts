import { ELEMENT_NODE, parse, renderSync, TEXT_NODE } from 'ultrahtml'
import {
  PLUTO_COMPONENT_ATTRIBUTE,
  readComponentMarker,
} from '../markdown/component'
import { decodeEntitiesOnce } from '../markdown/sanitize-html'

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
  | { kind: 'component'; name: string; props: Record<string, unknown> }

export const decodeHtmlEntities = decodeEntitiesOnce

interface HtmlNode {
  type: number
  name?: string
  value?: string
  attributes?: Record<string, string>
  children?: HtmlNode[]
}

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

export function hasEmbedParagraph(html: string): boolean {
  return html.includes('data-pluto-embed')
}

export function hasComponentMarker(html: string): boolean {
  return html.includes(PLUTO_COMPONENT_ATTRIBUTE)
}

export function splitBodyHtml(html: string): PlutoHtmlPart[] {
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
    const marker =
      node.name === 'div' ? readComponentMarker(attributes) : undefined
    if (marker) {
      parts.push({ kind: 'component', ...marker })
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
