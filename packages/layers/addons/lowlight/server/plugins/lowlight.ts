// Registers lowlight as a code highlighter of the site (`definePlutoHighlighter` of core). The
// public API colors the code blocks of a post with it; the theme CSS gives the colors. Choose
// another highlighter first with `plutoApi.highlighter`.
export default defineNitroPlugin(() => {
  definePlutoHighlighter({
    id: 'lowlight',
    order: 100,
    highlight: highlightWithLowlight,
  })
})
