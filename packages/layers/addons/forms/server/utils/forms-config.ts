import { createHmac, randomBytes } from 'node:crypto'

export interface PlutoFormsConfig {
  dev: boolean
  /** The name of the Nitro storage mount for the submissions. */
  storage: string
  secret: string
  secretSource: 'env' | 'github' | 'dev' | 'none'
  turnstileSiteKey: string
  turnstileSecret: string
  minFillMs: number
  rateLimit: number
}

export interface PlutoFormsRawConfig {
  storage?: unknown
  secret?: unknown
  turnstileSiteKey?: unknown
  turnstileSecret?: unknown
  minFillSeconds?: unknown
  rateLimit?: unknown
}

export const PLUTO_FORMS_DEV_MOUNT = 'pluto-forms'

let devSecret: string | undefined

function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : ''
}

function count(value: unknown, fallback: number): number {
  const number = Number(value)
  return value !== '' && Number.isFinite(number) && number >= 0
    ? number
    : fallback
}

/**
 * Reads the settings of the layer. The signing secret is `NUXT_PLUTO_FORMS_SECRET`. A site that
 * runs the Git CMS can leave it out: the layer then derives a key from the session password of
 * the CMS. In development, with neither, a random secret lasts until the server restarts.
 */
export function readFormsConfig(
  raw: PlutoFormsRawConfig | undefined,
  options: { githubSessionPassword?: string; dev: boolean }
): PlutoFormsConfig {
  const given = text(raw?.secret)
  const github = text(options.githubSessionPassword)
  let secret = ''
  let secretSource: PlutoFormsConfig['secretSource'] = 'none'

  if (given) {
    secret = given
    secretSource = 'env'
  } else if (github) {
    secret = createHmac('sha256', github).update('pluto-forms').digest('hex')
    secretSource = 'github'
  } else if (options.dev) {
    devSecret ??= randomBytes(32).toString('hex')
    secret = devSecret
    secretSource = 'dev'
  }

  return {
    dev: options.dev,
    storage: text(raw?.storage),
    secret,
    secretSource,
    turnstileSiteKey: text(raw?.turnstileSiteKey),
    turnstileSecret: text(raw?.turnstileSecret),
    minFillMs: Math.round(count(raw?.minFillSeconds, 3) * 1000),
    rateLimit: Math.max(1, Math.trunc(count(raw?.rateLimit, 5))),
  }
}

/** The settings of the layer, from the runtime config of the server. */
export function getFormsConfig(): PlutoFormsConfig {
  const config = useRuntimeConfig()
  const github = config.plutoGithub as
    | { sessionPassword?: string }
    | undefined
  return readFormsConfig(config.plutoForms as PlutoFormsRawConfig, {
    githubSessionPassword: github?.sessionPassword,
    dev: import.meta.dev,
  })
}
