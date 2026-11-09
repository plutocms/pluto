// The virtual modules of the block components (modules/pluto-blocks). This file has no top-level
// import, so the declarations are ambient modules.

// The block definitions of the `components/content/` files that call `definePlutoBlock`. Empty on
// the server: only the editors import it.
declare module '#pluto-blocks' {
  const blocks: Record<
    string,
    import('../utils/blocks/definition').PlutoBlockOverride
  >
  export default blocks
}

// A loader for each such file, by block key (kebab case). `PlutoHtml` renders a component of a
// post with it.
declare module '#pluto-block-components' {
  const components: Record<
    string,
    () => Promise<{ default: import('vue').Component }>
  >
  export default components
}
