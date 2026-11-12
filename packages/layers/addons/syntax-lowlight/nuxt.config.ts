// The lowlight add-on layer: it colors the code blocks of the posts on the site with lowlight (the
// grammars of highlight.js), for every backend. Add it next to the backend layer of the app:
// `extends: ['@plutocms/core', '@plutocms/syntax-lowlight']`, and import its theme in the CSS of the site:
// `@import '@plutocms/syntax-lowlight/theme.css'`. It does not extend `@plutocms/core` itself: the app or
// its backend layer brings core, so core loads once. See the README.
export default defineNuxtConfig({
  $meta: {
    name: 'syntax-lowlight',
  },
})
