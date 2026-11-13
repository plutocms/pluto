import type { PlutoI18nRuntimeConfig } from './i18n'

declare module '@nuxt/schema' {
  interface PublicRuntimeConfig {
    plutoI18n: PlutoI18nRuntimeConfig
  }
}

export {}
