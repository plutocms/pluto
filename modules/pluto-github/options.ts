import { parseGithubRepoUrl } from './git-remote'

export interface PlutoGithubOptions {
  /**
   * `'auto'` (the default) turns the CMS on unless a backend layer is present.
   * `true` turns it on and logs an error when a backend layer is present.
   * `false` turns it off.
   */
  enabled?: boolean | 'auto'
  /** Where the posts live. `fs` is valid in dev only. Default `fs` in dev, `github` in production. */
  storage?: 'github' | 'fs'
  github?: {
    /**
     * The repo as `owner/name`. Required when storage is `github`. Default: the env var
     * `NUXT_PLUTO_GITHUB_REPO` or `PLUTO_GITHUB_REPO`, then Vercel's repo, then (dev only)
     * the `origin` remote of the local git repo.
     */
    repo?: string
    /** Default `main`. */
    branch?: string
    /** The slug of the GitHub App editors sign in with. Default: `NUXT_PLUTO_GITHUB_APP_SLUG` or `PLUTO_GITHUB_APP_SLUG`. */
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

export interface ResolvedPlutoGithubOptions {
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

export interface PlutoGithubResolveContext {
  dev: boolean
  /** A backend layer is present: the supabase layer, `@nuxtjs/supabase`, or a layer with `$meta.plutoBackend`. */
  hasBackendLayer: boolean
  /** The env vars to read the defaults from. The module passes `process.env`. */
  env?: Record<string, string | undefined>
  /** The URL of the `origin` git remote. The module reads it in dev only. */
  gitOrigin?: string
}

export interface PlutoGithubResolveResult {
  enabled: boolean
  resolved: ResolvedPlutoGithubOptions
  warnings: string[]
  errors: string[]
}

/**
 * The env var names the CMS server code reads at run time. Nuxt maps
 * `NUXT_<name>` onto `runtimeConfig.plutoGithub`. The module never checks them
 * at build time.
 */
export const PLUTO_GITHUB_SECRET_ENV = {
  required: [
    'SESSION_PASSWORD',
    'APP_ID',
    'CLIENT_ID',
    'CLIENT_SECRET',
    'PRIVATE_KEY',
  ],
  optional: ['READ_TOKEN', 'ALLOWED_USERS'],
} as const

const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/
const DRIVE_PATTERN = /^[a-z]:/i

export const SUPABASE_CONFLICT_ERROR =
  'The standalone CMS cannot run with the supabase layer. Remove plutoGithub.enabled or the supabase layer.'

/**
 * Normalizes a content dir to forward slashes with no trailing slash.
 * Returns `undefined` when the dir is not a safe relative path.
 */
export function normalizeGithubDir(dir: string): string | undefined {
  const value = dir.trim().replaceAll('\\', '/')
  if (!value || value.startsWith('/') || DRIVE_PATTERN.test(value)) {
    return undefined
  }
  const segments = value
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.')
  if (segments.length === 0 || segments.includes('..')) {
    return undefined
  }
  return segments.join('/')
}

export function resolvePlutoGithubOptions(
  options: PlutoGithubOptions,
  ctx: PlutoGithubResolveContext
): PlutoGithubResolveResult {
  const warnings: string[] = []
  const errors: string[] = []
  const env = ctx.env ?? {}
  // The first name with a value wins.
  const fromEnv = (...names: string[]) =>
    names.map((name) => env[name]?.trim()).find(Boolean)

  const resolved: ResolvedPlutoGithubOptions = {
    storage:
      options.storage ??
      (fromEnv('PLUTO_GITHUB_STORAGE') as
        ResolvedPlutoGithubOptions['storage'] | undefined) ??
      (ctx.dev ? 'fs' : 'github'),
    github: {
      repo: options.github?.repo || detectRepo(ctx, fromEnv),
      branch: options.github?.branch ?? 'main',
      appSlug:
        options.github?.appSlug ??
        fromEnv('NUXT_PLUTO_GITHUB_APP_SLUG', 'PLUTO_GITHUB_APP_SLUG') ??
        '',
      apiUrl: (options.github?.apiUrl ?? 'https://api.github.com').replace(
        /\/+$/,
        ''
      ),
    },
    dir: 'content',
    commit: { skipDeploy: options.commit?.skipDeploy ?? true },
    cache: {
      headTtl: options.cache?.headTtl ?? 60,
      storage: options.cache?.storage ?? 'cache',
    },
    postType: options.postType ?? true,
  }

  const mode = options.enabled ?? 'auto'
  if (mode === false) {
    return { enabled: false, resolved, warnings, errors }
  }
  if (mode !== true && mode !== 'auto') {
    errors.push(
      `plutoGithub.enabled must be true, false or "auto". Got "${String(mode)}".`
    )
    return { enabled: false, resolved, warnings, errors }
  }

  if (ctx.hasBackendLayer) {
    // `auto` steps aside without a log. An explicit `true` is a mistake.
    if (mode === true) {
      errors.push(SUPABASE_CONFLICT_ERROR)
    }
    return { enabled: false, resolved, warnings, errors }
  }

  if (resolved.storage !== 'github' && resolved.storage !== 'fs') {
    errors.push(
      `plutoGithub.storage must be "github" or "fs". Got "${String(resolved.storage)}".`
    )
  } else if (resolved.storage === 'fs' && !ctx.dev) {
    errors.push(
      'plutoGithub.storage "fs" works in dev only. Use "github" for a build.'
    )
  } else if (resolved.storage === 'github' && !resolved.github.repo) {
    errors.push(
      'The standalone CMS needs a GitHub repo. Set plutoGithub.github.repo, or the PLUTO_GITHUB_REPO env var. ' +
        'Set plutoGithub.enabled to false to turn the CMS off.'
    )
  } else if (
    resolved.storage === 'github' &&
    !REPO_PATTERN.test(resolved.github.repo)
  ) {
    errors.push(
      `plutoGithub.github.repo must look like "owner/name". Got "${resolved.github.repo}".`
    )
  }

  if (options.dir !== undefined) {
    const dir = normalizeGithubDir(String(options.dir))
    if (dir === undefined) {
      errors.push(
        `plutoGithub.dir must be a relative path with no ".." segment. Got "${options.dir}".`
      )
    } else {
      resolved.dir = dir
    }
  }

  const ttl = resolved.cache.headTtl
  if (typeof ttl !== 'number' || !Number.isFinite(ttl) || ttl < 0) {
    errors.push(
      `plutoGithub.cache.headTtl must be a number of seconds, zero or more. Got "${String(ttl)}".`
    )
  }

  return { enabled: errors.length === 0, resolved, warnings, errors }
}

/** The default repo: env vars, then Vercel, then (dev only) the git remote. */
function detectRepo(
  ctx: PlutoGithubResolveContext,
  fromEnv: (...names: string[]) => string | undefined
): string {
  const explicit = fromEnv('NUXT_PLUTO_GITHUB_REPO', 'PLUTO_GITHUB_REPO')
  if (explicit) {
    return explicit
  }
  const owner = fromEnv('VERCEL_GIT_REPO_OWNER')
  const slug = fromEnv('VERCEL_GIT_REPO_SLUG')
  if (owner && slug) {
    return `${owner}/${slug}`
  }
  return ctx.dev && ctx.gitOrigin
    ? (parseGithubRepoUrl(ctx.gitOrigin) ?? '')
    : ''
}
