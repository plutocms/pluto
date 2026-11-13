import type { PlutoDeployHostId } from '../../shared/domain'
import type { GithubFetch } from '../github/client'
import { useRuntimeConfig } from 'nitropack/runtime'

export interface GithubConfig {
  dev: boolean
  storage: 'github' | 'fs'
  repo: string
  branch: string
  appSlug: string
  apiUrl: string
  dir: string
  fsRoot: string
  rootDir: string
  host: PlutoDeployHostId
  hostSite: string
  siteName: string
  skipDeploy: boolean
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
  allowedUsers: string[]
  fetch?: GithubFetch
}

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
    host:
      secret.host === 'vercel' || secret.host === 'netlify' ? secret.host : '',
    hostSite: text(secret.hostSite),
    siteName: text((config.public as Record<string, unknown>).websiteName),
    skipDeploy:
      secret.skipDeploy === true || String(secret.skipDeploy) === 'true',
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
