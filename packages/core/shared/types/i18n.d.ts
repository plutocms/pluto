import type { PlutoI18nRuntimeConfig } from './i18n'

// The `pluto-i18n` module fills this key. See modules/pluto-i18n/index.ts.
declare module '@nuxt/schema' {
  interface PublicRuntimeConfig {
    plutoI18n: PlutoI18nRuntimeConfig
  }
}

export {}
