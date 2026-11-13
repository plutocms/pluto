export default defineNitroPlugin(() => {
  definePlutoHighlighter({
    id: 'lowlight',
    order: 100,
    highlight: highlightWithLowlight,
  })
})
