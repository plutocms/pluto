// The shop add-on layer: the cart and the price helpers, for every backend. Add it next to the
// backend layer of the app: `extends: ['@plutocms/core', '@plutocms/shop']`. It does not extend
// `@plutocms/core` itself: the app or its backend layer brings core, so core loads once.
export default defineNuxtConfig({
  $meta: {
    name: 'shop',
  },
})
