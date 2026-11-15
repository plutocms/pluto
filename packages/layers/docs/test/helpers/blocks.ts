import type { PlutoBlockSources } from '#layers/pluto/shared/utils/blocks/definition'
import type { PlutoBlock } from '#layers/pluto/shared/utils/blocks/types'
import {
  describeBlock as coreDescribe,
  buildPalette as corePalette,
  toPreviewBlocks as corePreview,
} from '#layers/pluto/shared/utils/blocks/editor'
import {
  listPaletteBlocks as coreList,
  resolveBlockDefinition as coreResolve,
} from '#layers/pluto/shared/utils/blocks/registry'
import { BLOCK_PRESETS } from '../../shared/utils/block-presets'

export { BLOCK_PRESETS }

export function withPresets(sources: PlutoBlockSources = {}): PlutoBlockSources {
  return { presets: BLOCK_PRESETS, ...sources }
}

export function resolveBlockDefinition(
  name: string,
  options: Parameters<typeof coreResolve>[1] = {}
) {
  return coreResolve(name, { ...options, sources: withPresets(options.sources) })
}

export function listPaletteBlocks(sources?: PlutoBlockSources) {
  return coreList(withPresets(sources))
}

export function buildPalette(sources?: PlutoBlockSources, accepts?: string[]) {
  return corePalette(withPresets(sources), accepts)
}

export function describeBlock(block: PlutoBlock, sources?: PlutoBlockSources) {
  return coreDescribe(block, withPresets(sources))
}

export function toPreviewBlocks(
  blocks: PlutoBlock[],
  sources?: PlutoBlockSources
) {
  return corePreview(blocks, withPresets(sources))
}
