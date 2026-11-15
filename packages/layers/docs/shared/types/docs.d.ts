import type {
  PlutoDocsOptions,
  PlutoDocsRender,
  PlutoDocsTypeOptions,
} from '../../modules/pluto-docs/options'

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
}

export {}
