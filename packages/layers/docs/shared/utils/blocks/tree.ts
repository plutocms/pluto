// Helpers to walk the block tree. No Nuxt import.

import type {
  PlutoBlock,
  PlutoBlockDoc,
  PlutoBlockLocation,
  PlutoComponentBlock,
} from './types'

/** The children of a component in source order, over all slots. */
export function flatChildren(component: PlutoComponentBlock): PlutoBlock[] {
  return Object.values(component.slots).flat()
}

/** Calls `visit` for each block, parents first. */
export function walkBlocks(
  blocks: PlutoBlock[],
  visit: (block: PlutoBlock, parent?: PlutoComponentBlock) => void,
  parent?: PlutoComponentBlock
): void {
  for (const block of blocks) {
    visit(block, parent)
    if (block.kind === 'component') {
      walkBlocks(flatChildren(block), visit, block)
    }
  }
}

export function findBlock(
  doc: PlutoBlockDoc,
  id: string
): PlutoBlockLocation | undefined {
  const search = (
    blocks: PlutoBlock[],
    parent?: PlutoComponentBlock,
    slot?: string
  ): PlutoBlockLocation | undefined => {
    for (const [index, block] of blocks.entries()) {
      if (block.id === id) {
        return { block, parent, slot, index }
      }
      if (block.kind === 'component') {
        for (const [name, children] of Object.entries(block.slots)) {
          const found = search(children, block, name)
          if (found) {
            return found
          }
        }
      }
    }
    return undefined
  }
  return search(doc.blocks)
}

/** The ids from the top-level block down to the block. Empty when the id is unknown. */
export function pathOf(doc: PlutoBlockDoc, id: string): string[] {
  const search = (
    blocks: PlutoBlock[],
    trail: string[]
  ): string[] | undefined => {
    for (const block of blocks) {
      const next = [...trail, block.id]
      if (block.id === id) {
        return next
      }
      if (block.kind === 'component') {
        const found = search(flatChildren(block), next)
        if (found) {
          return found
        }
      }
    }
    return undefined
  }
  return search(doc.blocks, []) ?? []
}

let counter = 0

/** A new id for a block that is not from a parse. */
export function newBlockId(): string {
  counter++
  return `n${counter}`
}
