// The SEO add-on layer: SEO fields on the content types, head tags, a sitemap, robots.txt and an
// RSS feed, for every backend. Add it next to the backend layer of the app:
// `extends: ['@plutocms/core', '@plutocms/seo']`. It does not extend `@plutocms/core` itself:
// the app or its backend layer brings core, so core loads once.
export default defineNuxtConfig({
  $meta: {
    name: 'seo',
  },
})
