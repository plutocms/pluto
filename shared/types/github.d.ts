import type { PlutoGithubOptions } from '../../modules/pluto-github/options'

// The `pluto-github` module fills these keys. See modules/pluto-github/index.ts.
// The secret keys come from `NUXT_PLUTO_GITHUB_<NAME>` env vars at run time.
declare module '@nuxt/schema' {
  interface NuxtConfig {
    plutoGithub?: PlutoGithubOptions
  }
  interface NuxtOptions {
    plutoGithub?: PlutoGithubOptions
  }
  interface RuntimeConfig {
    plutoGithub?: {
      sessionPassword: string
      appId: string
      clientId: string
      clientSecret: string
      privateKey: string
      readToken: string
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
    plutoGithub?: {
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
