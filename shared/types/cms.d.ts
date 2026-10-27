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
      /** Comma-separated GitHub logins. Empty means every user with push access. */
      allowedUsers: string
      apiUrl: string
      skipDeploy: boolean
      headTtl: number
      cacheStorage: string
      postType: boolean
      /** The project root, for the dev fs store. Empty otherwise. */
      fsRoot: string
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
      /** The client registers the built-in post type only when this is true. */
      postType: boolean
      /** True when a save adds `[skip ci]`. The build status item shows only when this is false. */
      skipDeploy: boolean
    }
  }
}

export {}
