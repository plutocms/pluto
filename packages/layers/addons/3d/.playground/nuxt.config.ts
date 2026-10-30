// A small app for the development and the typecheck of the add-on: core (the root of this
// repo) and the add-on. Core runs with the GitHub CMS in development (files on disk).
export default defineNuxtConfig({
  extends: ['../../../../..', '..'],
  compatibilityDate: '2025-07-15',
})
