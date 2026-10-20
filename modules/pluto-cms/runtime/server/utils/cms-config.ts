import type { GithubFetch } from '../github/client'
import { useRuntimeConfig } from 'nitropack/runtime'

/**
 * The run-time config of the CMS server code, in one flat object. Only this
 * file reads `useRuntimeConfig`, so a test can replace it with a stub that
 * also sets `fetch` (the GitHub transport).
 */
export interface CmsConfig {
  dev: boolean
  storage: 'github' | 'fs'
  /** `owner/name`. */
  repo: string
  branch: string
  appSlug: string
  apiUrl: string
  dir: string
  /** The project root. Set for the `fs` store only. */
  fsRoot: string
  skipDeploy: boolean
  headTtl: number
  /** Seconds a CDN may cache a public read response. */
  publicMaxAge: number
  cacheStorage: string
  postType: boolean
  sessionPassword: string
  appId: string
  clientId: string
  clientSecret: string
  privateKey: string
  readToken: string
  /** Lowercase GitHub logins. Empty means every user with push access. */
  allowedUsers: string[]
  /** A test transport. The default uses `ofetch`. */
  fetch?: GithubFetch
}

/** Splits a comma-separated login list. It trims and lowercases each login. */
export function parseAllowedUsers(value: unknown): string[] {
  return String(value ?? '')
    .split(',')
    .map((login) => login.trim().toLowerCase())
    .filter(Boolean)
}

export function getCmsConfig(): CmsConfig {
  const config = useRuntimeConfig()
  const secret = (config.plutoCms ?? {}) as Record<string, unknown>
  const open = (config.public.plutoCms ?? {}) as Record<string, unknown>
  // Nuxt parses an env value like `12345` as a number, so accept numbers too.
  const text = (value: unknown, fallback = '') => (typeof value === 'string' || typeof value === 'number' ? String(value) : fallback)

  return {
    dev: import.meta.dev,
    storage: open.storage === 'fs' ? 'fs' : 'github',
    repo: text(open.repo),
    branch: text(open.branch, 'main'),
    appSlug: text(open.appSlug),
    apiUrl: text(secret.apiUrl, 'https://api.github.com'),
    dir: text(open.dir, 'content'),
    fsRoot: text(secret.fsRoot),
    skipDeploy: secret.skipDeploy !== false && String(secret.skipDeploy) !== 'false',
    headTtl: Number.isFinite(Number(secret.headTtl)) ? Number(secret.headTtl) : 60,
    publicMaxAge: Number.isFinite(Number(secret.publicMaxAge)) && Number(secret.publicMaxAge) >= 0 ? Number(secret.publicMaxAge) : 60,
    cacheStorage: text(secret.cacheStorage, 'cache'),
    postType: secret.postType !== false && String(secret.postType) !== 'false',
    sessionPassword: text(secret.sessionPassword),
    appId: text(secret.githubAppId),
    clientId: text(secret.githubClientId),
    clientSecret: text(secret.githubClientSecret),
    privateKey: text(secret.githubPrivateKey),
    readToken: text(secret.githubReadToken),
    allowedUsers: parseAllowedUsers(secret.allowedUsers),
  }
}
