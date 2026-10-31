import type {
  PlutoDocsOptions,
  PlutoDocsRender,
  PlutoDocsTypeOptions,
} from '../../modules/pluto-docs/options'
import type { PlutoBlocksConfig } from '../utils/blocks/types'

// The `pluto-docs` module fills the public key. See modules/pluto-docs/index.ts.
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
      /** `'hybrid'`, `'build'` or `'runtime'`. The composables read it. */
      render: PlutoDocsRender
      /** Seconds of the public cache of the layer routes. */
      runtimeMaxAge: number
    }
  }
  interface RuntimeConfig {
    plutoDocs?: {
      /** The `toc` option of `content.build.markdown`, for the run-time parser. */
      toc?: { depth?: number; searchDepth?: number }
    }
  }
  // A site declares its blocks in app.config.ts. See shared/utils/blocks/registry.ts.
  interface AppConfigInput {
    plutoBlocks?: PlutoBlocksConfig
  }
  interface AppConfig {
    plutoBlocks?: PlutoBlocksConfig
  }
}

export {}
