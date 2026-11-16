import { join } from 'node:path'
import { getComponentMeta } from 'nuxt-component-meta/parser'
import {
  BLOCK_MACRO,
  BlockCatalog,
  MACRO_KEY,
} from '../../../core/modules/pluto-blocks/catalog'

const root = join(__dirname, '..')

export const contentDir = join(root, 'app', 'components', 'content')

const read = (file: string) =>
  getComponentMeta(file, {
    rootDir: root,
    extendMetaFunctions: [
      { name: BLOCK_MACRO, transform: (arg) => ({ [MACRO_KEY]: arg }) },
    ],
  }) as never

export function readBlocks(warn: (message: string) => void = () => {}) {
  return new BlockCatalog(() => [contentDir], read, {
    warn,
    debug: () => {},
  }).collect()
}
