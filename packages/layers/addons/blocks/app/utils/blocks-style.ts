import type { VNode, VNodeArrayChildren } from 'vue'
import { Fragment } from 'vue'
import { withBasePath } from '#layers/pluto/shared/utils/html-base'
import { BLOCKS_COLOR_TOKENS, BLOCKS_SPACES } from './blocks-names'

const HEX_COLOR = /^#[0-9a-f]{3,8}$/i
const NAMED_COLOR = /^[a-z]{3,30}$/i
const COLOR_FUNCTION =
  /^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix|var)\([\w\s.,%/+*()#-]*\)$/i
const UNSAFE_CSS = /url\(|expression\(|@|\\|\/\*/i
const LENGTH = /^-?(?:\d+|\d*\.\d+)(?:px|rem|em|%|vh|vw|vmin|vmax|svh|dvh|ch)?$/
const FONT_STACK = /^[\w\s,'"-]+$/
const SCHEME = /^([a-z][a-z\d+.-]*):/i
const SAFE_SCHEMES = new Set(['http', 'https', 'mailto', 'tel'])

function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : ''
}

/** A CSS color that is safe to write in a style: a hex, a name, or a color function. */
export function blocksSafeColor(value: unknown): string | undefined {
  const color = text(value)
  if (!color || UNSAFE_CSS.test(color)) {
    return undefined
  }
  return HEX_COLOR.test(color) ||
    NAMED_COLOR.test(color) ||
    COLOR_FUNCTION.test(color)
    ? color
    : undefined
}

/** A font-family list that is safe to write in a style. */
export function blocksSafeFont(value: unknown): string | undefined {
  const font = text(value)
  return font && FONT_STACK.test(font) ? font : undefined
}

/** A token name (`primary`) or a CSS color, as a CSS value. */
export function blocksColor(value: unknown): string | undefined {
  const color = text(value)
  if (BLOCKS_COLOR_TOKENS.includes(color)) {
    return `var(--pluto-blocks-color-${color})`
  }
  return blocksSafeColor(color)
}

/** A CSS length: a number (pixels) or a number with a unit. */
export function blocksLength(value: unknown): string | undefined {
  const length = text(value)
  if (!LENGTH.test(length)) {
    return undefined
  }
  return /^-?[\d.]+$/.test(length) ? `${length}px` : length
}

/** A step of the spacing scale (`md`) or a CSS length, as a CSS value. */
export function blocksSpace(value: unknown): string | undefined {
  const space = text(value)
  if (space === 'none') {
    return '0'
  }
  if (BLOCKS_SPACES.includes(space)) {
    return `var(--pluto-blocks-space-${space})`
  }
  return blocksLength(space)
}

/** A width in percent: `50`, `50%`, or `50.5`. */
export function blocksPercent(value: unknown): number | undefined {
  const percent = text(value).replace(/%$/, '')
  const number = Number(percent)
  return percent !== '' &&
    Number.isFinite(number) &&
    number > 0 &&
    number <= 100
    ? number
    : undefined
}

export function blocksLevel(value: unknown, fallback = 2): number {
  const level = Math.round(Number(text(value)))
  return level >= 1 && level <= 6 ? level : fallback
}

/** A URL that is safe in a link or an image: a site path, an anchor, or http, mailto and tel. */
export function blocksUrl(value: unknown, baseURL = '/'): string | undefined {
  const url = text(value)
  if (!url) {
    return undefined
  }
  const scheme = SCHEME.exec(url)?.[1]?.toLowerCase()
  if (scheme && !SAFE_SCHEMES.has(scheme)) {
    return undefined
  }
  return withBasePath(url, baseURL)
}

/** The `url("...")` of a background image. */
export function blocksCssUrl(
  value: unknown,
  baseURL = '/'
): string | undefined {
  const url = blocksUrl(value, baseURL)
  if (!url || (SCHEME.test(url) && !/^https?:/i.test(url))) {
    return undefined
  }
  const encoded = url.replace(
    /["\\\n\r()]/g,
    (char) =>
      `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`
  )
  return `url("${encoded}")`
}

export interface BlocksLinkAttrs {
  href: string
  target?: string
  rel?: string
}

export function blocksLink(
  link: unknown,
  target: unknown,
  baseURL = '/'
): BlocksLinkAttrs | undefined {
  const href = blocksUrl(link, baseURL)
  if (!href) {
    return undefined
  }
  const blank = text(target) === '_blank'
  return {
    href,
    ...(blank ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
  }
}

function isParagraph(node: VNode): boolean {
  const type = node.type as unknown
  if (type === 'p') {
    return true
  }
  const component = type as { name?: string; __name?: string } | undefined
  return (
    typeof type === 'object' &&
    (component?.name === 'ProseP' || component?.__name === 'ProseP')
  )
}

function childrenOf(node: VNode): VNodeArrayChildren {
  const children = node.children as unknown
  if (Array.isArray(children)) {
    return children
  }
  if (typeof children === 'string') {
    return [children]
  }
  const slot = (children as { default?: () => VNode[] } | null)?.default
  return typeof slot === 'function' ? slot() : []
}

/**
 * Takes the text out of the paragraph that the Markdown parser puts around an inline slot, so a
 * heading or a list item has no `<p>` inside.
 */
export function blocksUnwrapParagraphs(
  nodes: VNodeArrayChildren
): VNodeArrayChildren {
  return nodes.flatMap((node): VNodeArrayChildren => {
    if (typeof node !== 'object' || node === null || Array.isArray(node)) {
      return [node]
    }
    const vnode = node as VNode
    if (vnode.type === Fragment && Array.isArray(vnode.children)) {
      return blocksUnwrapParagraphs(vnode.children)
    }
    return isParagraph(vnode)
      ? blocksUnwrapParagraphs(childrenOf(vnode))
      : [vnode]
  })
}
