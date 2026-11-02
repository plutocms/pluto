// The playground: a small app to develop the layers of this repo, and to typecheck the add-ons.
// It extends the layers by package name, like an app made from a template. The Bun workspace
// links the names to `packages/`, so a change in a layer shows here at once.
// Core runs with the Git CMS: in development, the content is files on disk.
export default defineNuxtConfig({
  extends: ['@plutocms/core', '@plutocms/3d'],

  css: ['~/assets/css/main.css'],

  compatibilityDate: '2025-07-15',
})
