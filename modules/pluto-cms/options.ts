export interface PlutoCmsOptions {
  /** Turns the standalone CMS on. Default `false`. */
  enabled?: boolean
  /** Where the posts live. `fs` is valid in dev only. Default `github`. */
  storage?: 'github' | 'fs'
  github?: {
    /** The repo as `owner/name`. Required when storage is `github`. */
    repo?: string
    /** Default `main`. */
    branch?: string
    /** The slug of the GitHub App editors sign in with. */
    appSlug?: string
    /** Default `https://api.github.com`. */
    apiUrl?: string
  }
  /** The folder of the content files, relative to the repo root. Default `content`. */
  dir?: string
  commit?: {
    /** Add a skip-deploy marker to the commit message. Default `true`. */
    skipDeploy?: boolean
  }
  cache?: {
    /** Seconds the head commit stays cached. Default `60`. */
    headTtl?: number
    /** The Nitro storage mount used for the cache. Default `cache`. */
    storage?: string
  }
  /** Register the fixed post content type. Default `true`. */
  postType?: boolean
}

export interface ResolvedPlutoCmsOptions {
  storage: 'github' | 'fs'
  github: {
    repo: string
    branch: string
    appSlug: string
    apiUrl: string
  }
  dir: string
  commit: {
    skipDeploy: boolean
  }
  cache: {
    headTtl: number
    storage: string
  }
  postType: boolean
}

export interface PlutoCmsResolveContext {
  dev: boolean
  hasSupabaseLayer: boolean
}

export interface PlutoCmsResolveResult {
  enabled: boolean
  resolved: ResolvedPlutoCmsOptions
  warnings: string[]
  errors: string[]
}

/**
 * The env var names the CMS server code reads at run time. Nuxt maps
 * `NUXT_<name>` onto `runtimeConfig.plutoCms`. The module never checks them
 * at build time.
 */
export const PLUTO_CMS_SECRET_ENV = {
  required: [
    'SESSION_PASSWORD',
    'GITHUB_APP_ID',
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
    'GITHUB_PRIVATE_KEY',
  ],
  optional: ['GITHUB_READ_TOKEN', 'ALLOWED_USERS'],
} as const

const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/
const DRIVE_PATTERN = /^[a-z]:/i

export const SUPABASE_CONFLICT_ERROR
  = 'The standalone CMS cannot run with the supabase layer. Remove plutoCms.enabled or the supabase layer.'

/**
 * Normalizes a content dir to forward slashes with no trailing slash.
 * Returns `undefined` when the dir is not a safe relative path.
 */
export function normalizeCmsDir(dir: string): string | undefined {
  const value = dir.trim().replaceAll('\\', '/')
  if (!value || value.startsWith('/') || DRIVE_PATTERN.test(value)) {
    return undefined
  }
  const segments = value.split('/').filter((segment) => segment !== '' && segment !== '.')
  if (segments.length === 0 || segments.includes('..')) {
    return undefined
  }
  return segments.join('/')
}

export function resolvePlutoCmsOptions(
  options: PlutoCmsOptions,
  ctx: PlutoCmsResolveContext
): PlutoCmsResolveResult {
  const warnings: string[] = []
  const errors: string[] = []

  const resolved: ResolvedPlutoCmsOptions = {
    storage: options.storage ?? 'github',
    github: {
      repo: options.github?.repo ?? '',
      branch: options.github?.branch ?? 'main',
      appSlug: options.github?.appSlug ?? '',
      apiUrl: (options.github?.apiUrl ?? 'https://api.github.com').replace(/\/+$/, ''),
    },
    dir: 'content',
    commit: { skipDeploy: options.commit?.skipDeploy ?? true },
    cache: {
      headTtl: options.cache?.headTtl ?? 60,
      storage: options.cache?.storage ?? 'cache',
    },
    postType: options.postType ?? true,
  }

  if (!options.enabled) {
    return { enabled: false, resolved, warnings, errors }
  }

  if (ctx.hasSupabaseLayer) {
    errors.push(SUPABASE_CONFLICT_ERROR)
    return { enabled: false, resolved, warnings, errors }
  }

  if (resolved.storage !== 'github' && resolved.storage !== 'fs') {
    errors.push(`plutoCms.storage must be "github" or "fs". Got "${String(resolved.storage)}".`)
  } else if (resolved.storage === 'fs' && !ctx.dev) {
    errors.push('plutoCms.storage "fs" works in dev only. Use "github" for a build.')
  } else if (resolved.storage === 'github' && !REPO_PATTERN.test(resolved.github.repo)) {
    errors.push(`plutoCms.github.repo must look like "owner/name". Got "${resolved.github.repo}".`)
  }

  if (options.dir !== undefined) {
    const dir = normalizeCmsDir(String(options.dir))
    if (dir === undefined) {
      errors.push(`plutoCms.dir must be a relative path with no ".." segment. Got "${options.dir}".`)
    } else {
      resolved.dir = dir
    }
  }

  const ttl = resolved.cache.headTtl
  if (typeof ttl !== 'number' || !Number.isFinite(ttl) || ttl < 0) {
    errors.push(`plutoCms.cache.headTtl must be a number of seconds, zero or more. Got "${String(ttl)}".`)
  }

  return { enabled: errors.length === 0, resolved, warnings, errors }
}
