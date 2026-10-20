import type { PlutoCmsOptions } from '../../modules/pluto-cms/options'

// The `pluto-cms` module fills these keys. See modules/pluto-cms/index.ts.
// The secret keys come from `NUXT_PLUTO_CMS_<NAME>` env vars at run time.
declare module '@nuxt/schema' {
  interface NuxtConfig {
    plutoCms?: PlutoCmsOptions
  }
  interface NuxtOptions {
    plutoCms?: PlutoCmsOptions
  }
  interface RuntimeConfig {
    plutoCms?: {
      sessionPassword: string
      githubAppId: string
      githubClientId: string
      githubClientSecret: string
      githubPrivateKey: string
      githubReadToken: string
    }
  }
  interface PublicRuntimeConfig {
    plutoCms?: {
      enabled: true
      repo: string
      branch: string
      appSlug: string
      storage: 'github' | 'fs'
      dir: string
    }
  }
}

export {}
