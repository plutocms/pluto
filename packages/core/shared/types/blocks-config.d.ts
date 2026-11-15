import type { PlutoBlocksConfig } from '../utils/blocks/definition'

declare module '@nuxt/schema' {
  interface AppConfigInput {
    plutoBlocks?: PlutoBlocksConfig
  }
  interface AppConfig {
    plutoBlocks?: PlutoBlocksConfig
  }
}

export {}
