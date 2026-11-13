// This file has no top-level import, so the declarations are ambient modules.
declare module '#pluto-blocks' {
  const blocks: Record<
    string,
    import('../utils/blocks/definition').PlutoBlockOverride
  >
  export default blocks
}

declare module '#pluto-block-components' {
  const components: Record<
    string,
    () => Promise<{ default: import('vue').Component }>
  >
  export default components
}
