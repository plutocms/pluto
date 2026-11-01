// `@plutocms/pluto` is now `@plutocms/core`. This last version of the old name only extends
// core, so an app or a layer that still names it keeps working, with one copy of core. It
// prints a warning when Nuxt loads it.
export default defineNuxtConfig({
  extends: ['@plutocms/core'],

  hooks: {
    'modules:done': () => {
      console.warn(
        '[pluto] @plutocms/pluto is now @plutocms/core. Replace @plutocms/pluto with @plutocms/core in package.json and nuxt.config.ts.'
      )
    },
  },
})
