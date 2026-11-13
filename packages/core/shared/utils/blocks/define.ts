import type { PlutoBlockPatch } from './definition'

/**
 * Describes a block in a component file of `components/content/`. It is auto-imported. At run time
 * it returns its argument: the build reads the call and makes the block definition from it. With a
 * generic, `definePlutoBlock<Props>({...})` checks that the keys of `props` are props of the
 * component.
 * @see https://pluto.vulmix.dev/docs/extend/author-components#add-the-macro
 */
export function definePlutoBlock<
  Props extends object = Record<string, unknown>,
>(definition: PlutoBlockPatch<Props>): PlutoBlockPatch<Props> {
  return definition
}
