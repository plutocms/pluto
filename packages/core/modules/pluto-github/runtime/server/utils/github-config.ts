import type { GithubFetch } from '../github/client'
import { useRuntimeConfig } from 'nitropack/runtime'

/**
 * The run-time config of the CMS server code, in one flat object. Only this
 * file reads `useRuntimeConfig`, so a test can replace it with a stub that
 * also sets `fetch` (the GitHub transport).
 */
export interface GithubConfig {
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
  /** The project root. Set in development only. The setup writes `.env` there. */
  rootDir: string
  /** The site name (`websiteName`), or an empty string. */
  siteName: string
  skipDeploy: boolean
  /** Local mode: commit each save to the local Git repo. */
  localCommit: boolean
  headTtl: number
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

export function getGithubConfig(): GithubConfig {
  const config = useRuntimeConfig()
  const secret = (config.plutoGithub ?? {}) as Record<string, unknown>
  const open = (config.public.plutoGithub ?? {}) as Record<string, unknown>
  // Nuxt parses an env value like `12345` as a number, so accept numbers too.
  const text = (value: unknown, fallback = '') =>
    typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : fallback

  return {
    dev: import.meta.dev,
    storage: open.storage === 'fs' ? 'fs' : 'github',
    repo: text(open.repo),
    branch: text(open.branch, 'main'),
    appSlug: text(open.appSlug),
    apiUrl: text(secret.apiUrl, 'https://api.github.com'),
    dir: text(open.dir, 'content'),
    fsRoot: text(secret.fsRoot),
    rootDir: text(secret.rootDir),
    siteName: text((config.public as Record<string, unknown>).websiteName),
    skipDeploy:
      secret.skipDeploy !== false && String(secret.skipDeploy) !== 'false',
    localCommit:
      secret.localCommit !== false && String(secret.localCommit) !== 'false',
    headTtl: Number.isFinite(Number(secret.headTtl))
      ? Number(secret.headTtl)
      : 60,
    cacheStorage: text(secret.cacheStorage, 'cache'),
    postType: secret.postType !== false && String(secret.postType) !== 'false',
    sessionPassword: text(secret.sessionPassword),
    appId: text(secret.appId),
    clientId: text(secret.clientId),
    clientSecret: text(secret.clientSecret),
    privateKey: text(secret.privateKey),
    readToken: text(secret.readToken),
    allowedUsers: parseAllowedUsers(secret.allowedUsers),
  }
}
