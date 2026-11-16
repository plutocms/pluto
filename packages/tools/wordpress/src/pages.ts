import type { BlockNode, WxrPost } from './types'
import { stripTags } from './html'

const DESCRIPTION_META = [
  '_yoast_wpseo_metadesc',
  'rank_math_description',
  '_aioseo_description',
]

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** The own slug of a page: its WordPress name, else its title, else its id. */
export function slugOf(post: Pick<WxrPost, 'slug' | 'title' | 'id'>): string {
  return (
    slugify(decode(post.slug)) ||
    slugify(post.title) ||
    `page-${post.id || 'import'}`
  )
}

/**
 * The path of every page, with its parents (`about/team`). The front page is `home`.
 * @see https://developer.wordpress.org/themes/basics/template-hierarchy/#front-page-display
 */
export function pagePaths(
  posts: WxrPost[],
  frontPageId: number | undefined
): Map<number, string> {
  const pages = new Map(
    posts.filter((post) => post.type === 'page').map((post) => [post.id, post])
  )
  const paths = new Map<number, string>()

  const pathOf = (post: WxrPost, seen: Set<number>): string => {
    const parent = pages.get(post.parent)

    if (!parent || seen.has(parent.id)) {
      return slugOf(post)
    }

    return `${pathOf(parent, new Set([...seen, post.id]))}/${slugOf(post)}`
  }

  for (const post of pages.values()) {
    paths.set(
      post.id,
      post.id === frontPageId ? 'home' : pathOf(post, new Set())
    )
  }

  return paths
}

export function isPublished(status: string): boolean {
  return status === 'publish'
}

export function descriptionOf(post: WxrPost): string | undefined {
  for (const key of DESCRIPTION_META) {
    const value = post.meta[key]?.trim()

    if (value) {
      return value
    }
  }

  const excerpt = stripTags(post.excerpt)

  return excerpt || undefined
}

export function publishedAt(date: string): string | undefined {
  if (!date || date.startsWith('0000')) {
    return undefined
  }

  const parsed = new Date(`${date.replace(' ', 'T')}Z`)

  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

/** Puts the new URL in place of each remote image URL, in the props and in the text. */
export function rewriteMedia(
  nodes: BlockNode[],
  map: Map<string, string>
): BlockNode[] {
  if (map.size === 0) {
    return nodes
  }

  return nodes.map((node) => {
    const props: BlockNode['props'] = {}

    for (const [key, value] of Object.entries(node.props)) {
      props[key] = typeof value === 'string' ? (map.get(value) ?? value) : value
    }

    let text = node.text

    if (text?.includes('http')) {
      for (const [from, to] of map) {
        text = text.split(from).join(to)
      }
    }

    return {
      ...node,
      props,
      text,
      children: node.children ? rewriteMedia(node.children, map) : undefined,
    }
  })
}
