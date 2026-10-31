// Marks the blocks in the parsed body of the preview page, so a click in the
// preview selects the block under the pointer, an inner block too. Pure: no
// DOM, no Nuxt. The nodes are the MDC AST of `parseMarkdown`.

import type { PlutoPreviewChild } from './preview-protocol'

/** The attribute that holds the block id on an element of the preview. */
export const PREVIEW_BLOCK_ATTRIBUTE = 'data-pluto-block'

/** The part of an MDC node that the marks read and write. */
export interface PlutoMarkNode {
  type: string
  tag?: string
  props?: Record<string, unknown>
  children?: PlutoMarkNode[]
}

/** `UPageSection` and `u-page-section` are the same component. */
function normalize(name: string): string {
  return name
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
}

/**
 * The elements where an inner block of a component can be: its direct
 * children (the default slot) and the children of its `template` elements
 * (the named slots), in source order. An inline component inside a paragraph
 * is never here, so it cannot take the place of an inner block.
 */
function slotElements(node: PlutoMarkNode): PlutoMarkNode[] {
  const elements: PlutoMarkNode[] = []
  for (const child of node.children ?? []) {
    if (child.type !== 'element') {
      continue
    }
    if (child.tag === 'template') {
      elements.push(
        ...(child.children ?? []).filter((inner) => inner.type === 'element')
      )
    } else {
      elements.push(child)
    }
  }
  return elements
}

/**
 * Puts the ids of `children` on the matching component elements under `node`.
 * The children are in source order over all slots, so the match goes in
 * order, by component name. An element with another name (a paragraph, a
 * list) is skipped. It changes the props of the matched elements in place,
 * so call it on a body from a new parse. Returns the number of marked
 * elements, at all levels.
 */
export function markPreviewChildren(
  node: PlutoMarkNode,
  children: PlutoPreviewChild[]
): number {
  let marked = 0
  let next = 0
  for (const element of slotElements(node)) {
    const child = children[next]
    if (!child) {
      break
    }
    if (element.tag && normalize(element.tag) === normalize(child.name)) {
      element.props = { ...element.props, [PREVIEW_BLOCK_ATTRIBUTE]: child.id }
      marked += 1 + markPreviewChildren(element, child.children ?? [])
      next++
    }
  }
  return marked
}

/** The number of children in a tree, at all levels. */
export function countPreviewChildren(
  children: PlutoPreviewChild[] | undefined
): number {
  return (children ?? []).reduce(
    (total, child) => total + 1 + countPreviewChildren(child.children),
    0
  )
}

/** The parent id of each child in a tree. A child of a top-level block has that block as parent. */
export function previewParents(
  blockId: string,
  children: PlutoPreviewChild[] | undefined,
  parents = new Map<string, string>()
): Map<string, string> {
  for (const child of children ?? []) {
    parents.set(child.id, blockId)
    previewParents(child.id, child.children, parents)
  }
  return parents
}
