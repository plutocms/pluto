import type { Wxr, WxrPost } from './types'
import { XMLParser } from 'fast-xml-parser'

type XmlNode = Record<string, unknown>

const LISTS = new Set(['item', 'wp:postmeta'])

function text(value: unknown): string {
  if (value === undefined || value === null) {
    return ''
  }

  if (typeof value === 'object') {
    const inner = (value as XmlNode)['#text']

    return inner === undefined ? '' : String(inner)
  }

  return String(value)
}

function list(value: unknown): XmlNode[] {
  if (value === undefined || value === null) {
    return []
  }

  return (Array.isArray(value) ? value : [value]) as XmlNode[]
}

function readPost(item: XmlNode): WxrPost {
  const meta: Record<string, string> = {}

  for (const entry of list(item['wp:postmeta'])) {
    const key = text(entry['wp:meta_key'])

    if (key) {
      meta[key] = text(entry['wp:meta_value'])
    }
  }

  return {
    id: Number(text(item['wp:post_id'])) || 0,
    type: text(item['wp:post_type']),
    status: text(item['wp:status']),
    title: text(item.title),
    slug: text(item['wp:post_name']),
    link: text(item.link),
    parent: Number(text(item['wp:post_parent'])) || 0,
    date: text(item['wp:post_date_gmt']) || text(item['wp:post_date']),
    content: text(item['content:encoded']),
    excerpt: text(item['excerpt:encoded']),
    attachmentUrl: text(item['wp:attachment_url']),
    meta,
  }
}

/**
 * Reads a WordPress eXtended RSS file (Tools > Export). It gives every post with its meta.
 * @see https://developer.wordpress.org/advanced-administration/wordpress/export/
 */
export function readWxr(xml: string): Wxr {
  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false,
    trimValues: false,
    processEntities: {
      enabled: true,
      maxTotalExpansions: Number.POSITIVE_INFINITY,
      maxExpandedLength: Number.POSITIVE_INFINITY,
    },
    isArray: (name) => LISTS.has(name),
  })

  const parsed = parser.parse(xml) as { rss?: { channel?: XmlNode } }
  const channel = parsed.rss?.channel

  if (!channel) {
    throw new Error('This file is not a WordPress export (no rss channel).')
  }

  const front = Number(text(channel['wp:page_on_front']))

  return {
    title: text(channel.title),
    link: text(channel.link),
    baseUrl: text(channel['wp:base_site_url']) || text(channel.link),
    frontPageId: front > 0 ? front : undefined,
    posts: list(channel.item).map(readPost),
  }
}
