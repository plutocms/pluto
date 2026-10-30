// A small app for the development and the typecheck of the add-on: core (`packages/core` of this
// repo) and the add-on. Core runs with the GitHub CMS in development (files on disk).
export default defineNuxtConfig({
  extends: ['../../../../core', '..'],
  compatibilityDate: '2025-07-15',
})
