import type { PlutoBlockPatch } from './types'

/**
 * Describes a block in `app.config.ts`, or in a component file of `components/content/`.
 * The module adds it as an auto-import, so a component file needs no import line.
 *
 * At run time it does nothing: it returns its argument. The build reads the call in the file and
 * makes the block definition from it. See the block-model skill. With a generic,
 * `definePlutoBlock<Props>({...})` checks that the keys of `props` are props of the component.
 */
export function definePlutoBlock<
  Props extends object = Record<string, unknown>,
>(definition: PlutoBlockPatch<Props>): PlutoBlockPatch<Props> {
  return definition
}
