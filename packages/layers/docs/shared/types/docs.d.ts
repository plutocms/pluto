import type {
  PlutoDocsOptions,
  PlutoDocsRender,
  PlutoDocsTypeOptions,
} from '../../modules/pluto-docs/options'
import type { PlutoBlocksConfig } from '../utils/blocks/types'

declare module '@nuxt/schema' {
  interface NuxtConfig {
    plutoDocs?: PlutoDocsOptions
  }
  interface NuxtOptions {
    plutoDocs?: PlutoDocsOptions
  }
  interface PublicRuntimeConfig {
    plutoDocs?: {
      types: PlutoDocsTypeOptions[]
      render: PlutoDocsRender
      runtimeMaxAge: number
    }
  }
  interface RuntimeConfig {
    plutoDocs?: {
      toc?: { depth?: number; searchDepth?: number }
    }
  }
  interface AppConfigInput {
    plutoBlocks?: PlutoBlocksConfig
  }
  interface AppConfig {
    plutoBlocks?: PlutoBlocksConfig
  }
}

export {}
