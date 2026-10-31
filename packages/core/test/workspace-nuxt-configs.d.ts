// The typecheck of core reads the whole workspace (`typescript.includeWorkspace`), so it also
// reads the nuxt.config.ts of the add-ons, the playground and the legacy package. Nuxt types
// their global `defineNuxtConfig` in their own `.nuxt` folders, which this project does not
// load. This declaration types it for them here.
declare global {
  function defineNuxtConfig<T>(config: T): T
}

export {}
