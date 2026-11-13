import type { H3Event, SessionConfig } from 'h3'
import type { GithubConfig } from './github-config'
import type { GithubPermissionLevel, OAuthTokens } from './github-oauth'
import { randomBytes } from 'node:crypto'
import { deleteCookie, getCookie, useSession } from 'h3'
import { createPlutoError } from '../../../../../server/utils/pluto-error'
import { PlutoGithubStoreError } from '../store/errors'
import { getGithubConfig } from './github-config'
import {
  fetchRepoPermission,
  mapRepoPermission,
  PlutoGithubOAuthError,
  refreshUserToken,
} from './github-oauth'

export const CMS_SESSION_NAME = 'pluto-github-session'
export const CMS_OAUTH_SESSION_NAME = 'pluto-github-oauth'

const SESSION_MAX_AGE = 7 * 24 * 60 * 60
const OAUTH_MAX_AGE = 10 * 60
const MIN_PASSWORD_LENGTH = 32
const REFRESH_MARGIN = 5 * 60 * 1000
const RECHECK_AFTER = 10 * 60 * 1000

export interface GithubSessionUser {
  id: number
  login: string
  name: string | null
  avatarUrl: string
}

export interface GithubSessionData {
  user: GithubSessionUser
  token: string
  refreshToken?: string
  expiresAt?: number
  refreshExpiresAt?: number
  permission: GithubPermissionLevel
  capabilities: string[]
  checkedAt: number
  repoPrivate?: boolean
}

export interface GithubSession extends GithubSessionData {
  local?: boolean
}

const LOCAL_SESSION: GithubSession = {
  user: { id: 0, login: 'local', name: 'Local', avatarUrl: '' },
  token: '',
  permission: 'admin',
  capabilities: ['*'],
  checkedAt: 0,
  local: true,
}

const MEMO_KEY = '__plutoGithubSession'
const logged = new Set<string>()

function logOnce(key: string, message: string): void {
  if (!logged.has(key)) {
    logged.add(key)
    console.error(`[pluto-github] ${message}`)
  }
}

function signInRequired() {
  return createPlutoError({
    statusCode: 401,
    message: 'Sign in to continue.',
    key: 'pluto.github.errors.signInRequired',
  })
}

function githubUnavailable() {
  return createPlutoError({
    statusCode: 503,
    message: 'GitHub did not answer as expected. Try again.',
    key: 'pluto.github.errors.githubUnavailable',
  })
}

export function authNotConfigured() {
  return createPlutoError({
    statusCode: 500,
    message: 'Sign-in for the CMS is not set up.',
    key: 'pluto.github.errors.authNotConfigured',
  })
}

let devPassword: string | undefined

export function resolveSessionPassword(config: GithubConfig): string {
  if (config.sessionPassword.length >= MIN_PASSWORD_LENGTH) {
    return config.sessionPassword
  }
  if (config.dev) {
    devPassword ??= randomBytes(32).toString('base64url')
    logOnce(
      'dev-password',
      'NUXT_PLUTO_GITHUB_SESSION_PASSWORD is missing or short. Using a random password for this dev process.'
    )
    return devPassword
  }
  logOnce(
    'password',
    'NUXT_PLUTO_GITHUB_SESSION_PASSWORD must have 32 characters or more. Sign-in is off until you set it.'
  )
  throw authNotConfigured()
}

function sessionOptions(
  config: GithubConfig,
  name: string,
  maxAge: number
): SessionConfig {
  return {
    name,
    password: resolveSessionPassword(config),
    maxAge,
    // The cookie is the only way to carry a session. No header.
    sessionHeader: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: !config.dev,
      path: '/',
    },
  }
}

export function useGithubSession(
  event: H3Event,
  config: GithubConfig = getGithubConfig()
) {
  return useSession<Partial<GithubSessionData>>(
    event,
    sessionOptions(config, CMS_SESSION_NAME, SESSION_MAX_AGE)
  )
}

export interface GithubOAuthState {
  state: string
  verifier: string
  redirect: string
}

export function useGithubOAuthSession(
  event: H3Event,
  config: GithubConfig = getGithubConfig()
) {
  return useSession<Partial<GithubOAuthState>>(
    event,
    sessionOptions(config, CMS_OAUTH_SESSION_NAME, OAUTH_MAX_AGE)
  )
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])
const LOCAL_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

function devProxyClientAddress(
  header: string | string[] | undefined
): string | undefined {
  const value = Array.isArray(header) ? header.join(',') : header
  const last = value
    ?.split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .at(-1)
  return last || undefined
}

// Only a direct loopback connection with no proxy header and a local Host passes: this blocks tunnels and DNS rebinding.
export function isLocalRequest(event: H3Event): boolean {
  const req = event.node?.req
  if (!req) {
    return false
  }
  const address = req.socket?.remoteAddress
  if (address) {
    if (
      !LOCAL_ADDRESSES.has(address) ||
      req.headers['x-forwarded-for'] ||
      req.headers.forwarded
    ) {
      return false
    }
  } else {
    const client = devProxyClientAddress(req.headers['x-forwarded-for'])
    if (!client || !LOCAL_ADDRESSES.has(client) || req.headers.forwarded) {
      return false
    }
  }
  const host = String(req.headers.host ?? '').toLowerCase()
  const name = host.startsWith('[')
    ? host.slice(0, host.indexOf(']') + 1)
    : host.split(':')[0]!
  return LOCAL_HOSTS.has(name)
}

const refreshing = new Map<string, Promise<OAuthTokens>>()
const refreshed = new Map<
  string,
  {
    tokens: OAuthTokens
    at: number
  }
>()
const REFRESH_REUSE = 60 * 1000

function refreshOnce(
  config: GithubConfig,
  refreshToken: string
): Promise<OAuthTokens> {
  const now = Date.now()
  for (const [key, entry] of refreshed) {
    if (now - entry.at > REFRESH_REUSE) {
      refreshed.delete(key)
    }
  }
  const recent = refreshed.get(refreshToken)
  if (recent) {
    return Promise.resolve(recent.tokens)
  }
  const running = refreshing.get(refreshToken)
  if (running) {
    return running
  }
  const promise = refreshUserToken({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    refreshToken,
    apiUrl: config.apiUrl,
    fetch: config.fetch,
  })
    .then((tokens) => {
      refreshed.set(refreshToken, { tokens, at: Date.now() })
      return tokens
    })
    .finally(() => {
      refreshing.delete(refreshToken)
    })
  refreshing.set(refreshToken, promise)
  return promise
}

function isSessionData(
  data: Partial<GithubSessionData>
): data is GithubSessionData {
  return Boolean(
    data.user &&
    typeof data.user.login === 'string' &&
    typeof data.token === 'string' &&
    data.token !== '' &&
    Array.isArray(data.capabilities) &&
    typeof data.checkedAt === 'number'
  )
}

async function loadSession(
  event: H3Event,
  config: GithubConfig
): Promise<GithubSession | null> {
  if (config.dev && config.storage === 'fs') {
    return isLocalRequest(event) ? LOCAL_SESSION : null
  }
  // No cookie means signed out. Do not open the session: that would set a
  // cookie on every anonymous response and break the cache of public pages.
  if (!getCookie(event, CMS_SESSION_NAME)) {
    return null
  }

  const session = await useGithubSession(event, config)
  if (!isSessionData(session.data)) {
    return null
  }
  let current: GithubSessionData = { ...session.data }

  if (
    current.expiresAt !== undefined &&
    current.expiresAt - REFRESH_MARGIN < Date.now()
  ) {
    if (
      !current.refreshToken ||
      (current.refreshExpiresAt !== undefined &&
        current.refreshExpiresAt < Date.now())
    ) {
      dropSessionCookie(event, config)
      throw signInRequired()
    }
    try {
      const tokens = await refreshOnce(config, current.refreshToken)
      current = {
        ...current,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        refreshExpiresAt: tokens.refreshExpiresAt,
      }
      await session.update(current)
    } catch (error) {
      if (error instanceof PlutoGithubOAuthError) {
        dropSessionCookie(event, config)
        throw signInRequired()
      }
      console.error('[pluto-github] Could not refresh the GitHub token.', error)
      throw githubUnavailable()
    }
  }

  if (Date.now() - current.checkedAt > RECHECK_AFTER) {
    try {
      const repo = await fetchRepoPermission(current.token, config.repo, {
        apiUrl: config.apiUrl,
        fetch: config.fetch,
      })
      const mapped = repo ? mapRepoPermission(repo.permissions) : null
      if (!mapped) {
        dropSessionCookie(event, config)
        throw signInRequired()
      }
      current = {
        ...current,
        permission: mapped.permission,
        capabilities: mapped.capabilities,
        checkedAt: Date.now(),
        repoPrivate: repo?.private,
      }
      await session.update(current)
    } catch (error) {
      if (error instanceof PlutoGithubStoreError && error.code === 'auth') {
        dropSessionCookie(event, config)
        throw signInRequired()
      }
      if (error instanceof PlutoGithubStoreError) {
        // GitHub is down or limits us. We cannot prove the access, so deny
        // this request. The session stays, so the next request tries again.
        console.error(
          '[pluto-github] Could not check the repo permission.',
          error
        )
        throw githubUnavailable()
      }
      throw error
    }
  }

  return current
}

export function getGithubSession(
  event: H3Event
): Promise<GithubSession | null> {
  const context = event.context as Record<string, unknown>
  const memo = context[MEMO_KEY] as Promise<GithubSession | null> | undefined
  if (memo) {
    return memo
  }
  const promise = loadSession(event, getGithubConfig())
  context[MEMO_KEY] = promise
  return promise
}

export async function requireGithubSession(
  event: H3Event
): Promise<GithubSession> {
  const session = await getGithubSession(event)
  if (!session) {
    throw signInRequired()
  }
  return session
}

export async function requireGithubCapability(
  event: H3Event,
  capability: string
): Promise<GithubSession> {
  const session = await requireGithubSession(event)
  if (
    !session.capabilities.includes('*') &&
    !session.capabilities.includes(capability)
  ) {
    throw createPlutoError({
      statusCode: 403,
      message: 'You do not have permission to do this.',
      key: 'pluto.github.errors.forbidden',
      params: { capability },
    })
  }
  return session
}

export async function setGithubSession(
  event: H3Event,
  data: GithubSessionData
): Promise<void> {
  const session = await useGithubSession(event)
  await session.update(data)
  delete (event.context as Record<string, unknown>)[MEMO_KEY]
}

function dropSessionCookie(event: H3Event, config: GithubConfig): void {
  const context = event.context as Record<string, unknown>
  delete (context.sessions as Record<string, unknown> | undefined)?.[
    CMS_SESSION_NAME
  ]
  deleteCookie(event, CMS_SESSION_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: !config.dev,
    path: '/',
  })
}

export function clearGithubSession(
  event: H3Event,
  config: GithubConfig = getGithubConfig()
): void {
  dropSessionCookie(event, config)
  const context = event.context as Record<string, unknown>
  context[MEMO_KEY] = Promise.resolve(null)
}
