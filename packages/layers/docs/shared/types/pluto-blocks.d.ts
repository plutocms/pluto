// The component layer of the block editor: the blocks of the `components/content/` files that call
// `definePlutoBlock`. The module makes it as a Vite virtual module. See modules/pluto-docs/blocks.ts.
// This file has no top-level import, so the declaration is an ambient module.
declare module '#pluto-docs/blocks' {
  const blocks: Record<
    string,
    import('../utils/blocks/types').PlutoBlockOverride
  >
  export default blocks
}
