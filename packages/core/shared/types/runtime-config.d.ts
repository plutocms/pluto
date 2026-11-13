import type { PlutoMailConfig } from './mail'

declare module '@nuxt/schema' {
  interface RuntimeConfig {
    plutoMail: PlutoMailConfig
  }
}

export {}
