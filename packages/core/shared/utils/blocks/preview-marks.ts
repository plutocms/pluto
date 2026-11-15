import type { ElementNode, Node } from 'comark'
import type { PlutoPreviewChild } from './preview-protocol'

export const PREVIEW_BLOCK_ATTRIBUTE = 'data-pluto-block'

function normalize(name: string): string {
  return name
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
}

function isElement(node: Node): node is ElementNode {
  return Array.isArray(node) && typeof node[0] === 'string'
}

function slotElements(node: ElementNode): ElementNode[] {
  const elements: ElementNode[] = []
  for (const child of node.slice(2) as Node[]) {
    if (!isElement(child)) {
      continue
    }
    if (child[0] === 'template') {
      elements.push(...(child.slice(2) as Node[]).filter(isElement))
    } else {
      elements.push(child)
    }
  }
  return elements
}

export function markPreviewChildren(
  node: ElementNode,
  children: PlutoPreviewChild[]
): number {
  let marked = 0
  let next = 0
  for (const element of slotElements(node)) {
    const child = children[next]
    if (!child) {
      break
    }
    if (normalize(element[0]) === normalize(child.name)) {
      element[1] = { ...element[1], [PREVIEW_BLOCK_ATTRIBUTE]: child.id }
      marked += 1 + markPreviewChildren(element, child.children ?? [])
      next++
    }
  }
  return marked
}

export function countPreviewChildren(
  children: PlutoPreviewChild[] | undefined
): number {
  return (children ?? []).reduce(
    (total, child) => total + 1 + countPreviewChildren(child.children),
    0
  )
}

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
