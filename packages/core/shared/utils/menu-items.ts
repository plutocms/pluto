import type { MarkdownDocument } from 'comark'
import type { PlutoMenuItem } from '../types/public-api'

type MenuNode = [string, Record<string, unknown>, ...unknown[]]

function isMenuItem(node: unknown): node is MenuNode {
  return Array.isArray(node) && node[0] === 'menu-item'
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function itemsOf(nodes: unknown[]): PlutoMenuItem[] {
  return nodes.filter(isMenuItem).map((node) => {
    const props = node[1] ?? {}
    const target =
      props.target === '_blank' || props.target === '_self'
        ? props.target
        : undefined

    return {
      label: text(props.label),
      to: text(props.link),
      ...(target && { target }),
      children: itemsOf(node.slice(2)),
    }
  })
}

/**
 * The items of a menu, from the `blocks` of the public menu: the `menu-item` blocks, with the
 * items nested in them as `children`. Other blocks are skipped.
 * @example
 * const items = plutoMenuItems(menu.blocks)
 * @see https://pluto.vulmix.dev/docs/build/menus
 */
export function plutoMenuItems(
  blocks: MarkdownDocument | null | undefined
): PlutoMenuItem[] {
  return itemsOf(blocks?.nodes ?? [])
}
