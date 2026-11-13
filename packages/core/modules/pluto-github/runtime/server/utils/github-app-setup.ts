import { Buffer } from 'node:buffer'
import { createPrivateKey } from 'node:crypto'
import { normalizePem } from '../github/app-token'

export const SETUP_BASE_PATH = '/api/_pluto/github/setup'
export const SETUP_CALLBACK_PATH = `${SETUP_BASE_PATH}/callback`
export const AUTH_CALLBACK_PATH = '/api/_pluto/auth/github/callback'
export const SETUP_STATE_COOKIE = 'pluto-github-setup'
export const SETUP_STATE_MAX_AGE = 10 * 60

const MIN_PASSWORD_LENGTH = 32
const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/
const APP_NAME_MAX = 34
const NAME_SUFFIX = ' CMS'

export const SETUP_ENV_KEYS = {
  appId: 'NUXT_PLUTO_GITHUB_APP_ID',
  clientId: 'NUXT_PLUTO_GITHUB_CLIENT_ID',
  clientSecret: 'NUXT_PLUTO_GITHUB_CLIENT_SECRET',
  privateKey: 'NUXT_PLUTO_GITHUB_PRIVATE_KEY',
  appSlug: 'PLUTO_GITHUB_APP_SLUG',
  sessionPassword: 'NUXT_PLUTO_GITHUB_SESSION_PASSWORD',
} as const

export function manifestAppName(siteName: string | undefined): string {
  const base = (siteName ?? '').trim().replace(/\s+/g, ' ')
  const name = base === '' ? 'Pluto' : base
  return `${name.slice(0, APP_NAME_MAX - NAME_SUFFIX.length).trim()}${NAME_SUFFIX}`
}

const LOCAL_NAMES = new Set(['localhost', '127.0.0.1', '[::1]'])

export function isLocalOrigin(origin: string): boolean {
  try {
    return LOCAL_NAMES.has(new URL(origin).hostname.toLowerCase())
  } catch {
    return false
  }
}

export interface AppManifest {
  name: string
  url: string
  redirect_url: string
  callback_urls: string[]
  public: boolean
  default_permissions: Record<string, string>
  default_events: string[]
  request_oauth_on_install: boolean
}

export function buildAppManifest(options: {
  siteName?: string
  origin: string
}): AppManifest {
  const origin = options.origin.replace(/\/+$/, '')
  const callbacks = [`${origin}${AUTH_CALLBACK_PATH}`]
  if (!isLocalOrigin(origin)) {
    callbacks.push(`http://localhost:3000${AUTH_CALLBACK_PATH}`)
  }
  return {
    name: manifestAppName(options.siteName),
    url: origin,
    redirect_url: `${origin}${SETUP_CALLBACK_PATH}`,
    callback_urls: callbacks,
    public: false,
    default_permissions: {
      contents: 'write',
      metadata: 'read',
      checks: 'read',
      statuses: 'read',
      deployments: 'read',
    },
    default_events: [],
    request_oauth_on_install: false,
  }
}

export function manifestFormAction(options: {
  webBase: string
  owner?: string
  ownerType?: string
  state: string
}): string {
  const base = options.webBase.replace(/\/+$/, '')
  const state = encodeURIComponent(options.state)
  if (options.ownerType === 'Organization' && options.owner) {
    return `${base}/organizations/${encodeURIComponent(options.owner)}/settings/apps/new?state=${state}`
  }
  return `${base}/settings/apps/new?state=${state}`
}

export function installUrl(webBase: string, slug: string): string {
  return `${webBase.replace(/\/+$/, '')}/apps/${encodeURIComponent(slug)}/installations/new`
}

export function repoOwner(repo: string): string {
  const [owner = ''] = repo.split('/')
  return owner
}

export function firstLanguage(header: string | undefined): string | undefined {
  const tag = header?.split(',')[0]?.split(';')[0]?.trim()
  return tag || undefined
}

export interface ConvertedApp {
  id: number | string
  slug: string
  clientId: string
  clientSecret: string
  pem: string
  htmlUrl: string
}

export function parseConversion(data: unknown): ConvertedApp | null {
  if (!data || typeof data !== 'object') {
    return null
  }
  const body = data as Record<string, unknown>
  const text = (value: unknown) => (typeof value === 'string' ? value : '')
  const id =
    typeof body.id === 'number' || typeof body.id === 'string' ? body.id : ''
  const app: ConvertedApp = {
    id,
    slug: text(body.slug),
    clientId: text(body.client_id),
    clientSecret: text(body.client_secret),
    pem: text(body.pem),
    htmlUrl: text(body.html_url),
  }
  return app.id !== '' &&
    app.slug &&
    app.clientId &&
    app.clientSecret &&
    app.pem
    ? app
    : null
}

export type EnvEntries = Array<[key: string, value: string]>

export function buildEnvEntries(
  app: ConvertedApp,
  sessionPassword?: string
): EnvEntries {
  const entries: EnvEntries = [
    [SETUP_ENV_KEYS.appId, String(app.id)],
    [SETUP_ENV_KEYS.clientId, app.clientId],
    [SETUP_ENV_KEYS.clientSecret, app.clientSecret],
    [SETUP_ENV_KEYS.privateKey, Buffer.from(app.pem.trim()).toString('base64')],
    [SETUP_ENV_KEYS.appSlug, app.slug],
  ]
  if (sessionPassword) {
    entries.push([SETUP_ENV_KEYS.sessionPassword, sessionPassword])
  }
  return entries
}

export function formatEnvBlock(entries: EnvEntries): string {
  return `${entries.map(([key, value]) => `${key}=${value}`).join('\n')}\n`
}

function lineSetsKey(line: string, key: string): boolean {
  const match = /^\s*(?:export\s+)?([A-Z_]\w*)\s*=/i.exec(line)
  return match?.[1] === key
}

function opensMultiline(line: string): boolean {
  const value = line.slice(line.indexOf('=') + 1).trim()
  const quote = value[0]
  if (quote !== '"' && quote !== "'" && quote !== '`') {
    return false
  }
  return !(value.length > 1 && value.endsWith(quote))
}

export function updateEnvText(text: string, entries: EnvEntries): string {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text === '' ? [] : text.split(/\r?\n/)
  const hadFinalBreak = lines.length > 0 && lines.at(-1) === ''
  if (hadFinalBreak) {
    lines.pop()
  }

  const names = entries.map(([name]) => name)
  const pending = new Map(entries)
  const output: string[] = []
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!
    const key = names.find((name) => lineSetsKey(line, name))
    if (!key) {
      output.push(line)
      continue
    }
    if (opensMultiline(line)) {
      const quote = line.slice(line.indexOf('=') + 1).trim()[0]!
      while (index + 1 < lines.length) {
        index++
        if (lines[index]!.trimEnd().endsWith(quote)) {
          break
        }
      }
    }
    if (pending.has(key)) {
      output.push(`${key}=${pending.get(key)}`)
      pending.delete(key)
    }
  }

  for (const [key, value] of pending) {
    output.push(`${key}=${value}`)
  }
  return `${output.join(eol)}${eol}`
}

export function isEnvIgnored(gitignore: string): boolean {
  return gitignore
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) =>
      ['.env', '/.env', '.env*', '*.env', '**/.env', '.env/'].includes(line)
    )
}

export type SetupCheckId =
  | 'repo'
  | 'sessionPassword'
  | 'appId'
  | 'clientId'
  | 'clientSecret'
  | 'privateKey'
  | 'installation'

export interface SetupCheck {
  id: SetupCheckId
  ok: boolean
}

export function isPrivateKeyReadable(value: string): boolean {
  if (value.trim() === '') {
    return false
  }
  try {
    return createPrivateKey(normalizePem(value)).asymmetricKeyType === 'rsa'
  } catch {
    return false
  }
}

export interface SetupInput {
  repo: string
  sessionPassword: string
  appId: string
  clientId: string
  clientSecret: string
  privateKey: string
  installed?: boolean
}

export function needsInstallationCheck(
  input: Pick<SetupInput, 'repo' | 'appId' | 'privateKey'>
): boolean {
  return (
    REPO_PATTERN.test(input.repo) &&
    input.appId.trim() !== '' &&
    isPrivateKeyReadable(input.privateKey)
  )
}

export function computeSetupChecks(input: SetupInput): {
  ready: boolean
  checks: SetupCheck[]
} {
  const checks: SetupCheck[] = [
    { id: 'repo', ok: REPO_PATTERN.test(input.repo) },
    {
      id: 'sessionPassword',
      ok: input.sessionPassword.length >= MIN_PASSWORD_LENGTH,
    },
    { id: 'appId', ok: input.appId.trim() !== '' },
    { id: 'clientId', ok: input.clientId.trim() !== '' },
    { id: 'clientSecret', ok: input.clientSecret.trim() !== '' },
    { id: 'privateKey', ok: isPrivateKeyReadable(input.privateKey) },
  ]
  const ready = checks
    .filter((check) => check.id !== 'repo')
    .every((check) => check.ok)
  if (input.installed !== undefined) {
    checks.push({ id: 'installation', ok: input.installed })
  }
  return { ready, checks }
}
