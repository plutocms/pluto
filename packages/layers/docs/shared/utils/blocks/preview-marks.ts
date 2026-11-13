import type { PlutoPreviewChild } from './preview-protocol'

export const PREVIEW_BLOCK_ATTRIBUTE = 'data-pluto-block'

export interface PlutoMarkNode {
  type: string
  tag?: string
  props?: Record<string, unknown>
  children?: PlutoMarkNode[]
}

function normalize(name: string): string {
  return name
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
}

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
