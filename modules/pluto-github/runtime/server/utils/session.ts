import type { H3Event, SessionConfig } from 'h3'
import type { GithubConfig } from './github-config'
import type { GithubPermissionLevel, OAuthTokens } from './github-oauth'
import { randomBytes } from 'node:crypto'
import { deleteCookie, getCookie, useSession } from 'h3'
import { createPlutoError } from '../../../../../server/utils/pluto-error'
import { PlutoGithubStoreError } from '../store/errors'
import { getGithubConfig } from './github-config'
import { fetchRepoPermission, mapRepoPermission, PlutoGithubOAuthError, refreshUserToken } from './github-oauth'

export const CMS_SESSION_NAME = 'pluto-github-session'
export const CMS_OAUTH_SESSION_NAME = 'pluto-github-oauth'

const SESSION_MAX_AGE = 7 * 24 * 60 * 60
const OAUTH_MAX_AGE = 10 * 60
const MIN_PASSWORD_LENGTH = 32
/** Refresh the user token when it ends in less than this many ms. */
const REFRESH_MARGIN = 5 * 60 * 1000
/** Check the repo permission again when the last check is older than this many ms. */
const RECHECK_AFTER = 10 * 60 * 1000

export interface GithubSessionUser {
  id: number
  login: string
  name: string | null
  avatarUrl: string
}

/** What the sealed cookie holds. It never leaves the server in a response body. */
export interface GithubSessionData {
  user: GithubSessionUser
  /** The GitHub user token. */
  token: string
  refreshToken?: string
  /** Epoch ms. Unset when the token does not expire. */
  expiresAt?: number
  refreshExpiresAt?: number
  permission: GithubPermissionLevel
  capabilities: string[]
  /** Epoch ms of the last repo permission check. */
  checkedAt: number
  /** Whether the repo is private. The admin warns when it is public. */
  repoPrivate?: boolean
}

export interface GithubSession extends GithubSessionData {
  /** True for the fixed local user of the dev `fs` store. */
  local?: boolean
}

/** The dev user of the `fs` store. It has no GitHub token. */
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

/** The 500 error for a CMS that has no sign-in set up. */
export function authNotConfigured() {
  return createPlutoError({
    statusCode: 500,
    message: 'Sign-in for the CMS is not set up.',
    key: 'pluto.github.errors.authNotConfigured',
  })
}

let devPassword: string | undefined

/**
 * The password that seals the cookies. It needs 32 characters or more. In
 * production a missing or short password is an error: the CMS refuses to
 * serve sign-in. In dev it uses a random password for this process, so a
 * restart signs everyone out.
 */
export function resolveSessionPassword(config: GithubConfig): string {
  if (config.sessionPassword.length >= MIN_PASSWORD_LENGTH) {
    return config.sessionPassword
  }
  if (config.dev) {
    devPassword ??= randomBytes(32).toString('base64url')
    logOnce('dev-password', 'NUXT_PLUTO_GITHUB_SESSION_PASSWORD is missing or short. Using a random password for this dev process.')
    return devPassword
  }
  logOnce('password', 'NUXT_PLUTO_GITHUB_SESSION_PASSWORD must have 32 characters or more. Sign-in is off until you set it.')
  throw authNotConfigured()
}

function sessionOptions(config: GithubConfig, name: string, maxAge: number): SessionConfig {
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

/** The sealed session of the signed-in user. */
export function useGithubSession(event: H3Event, config: GithubConfig = getGithubConfig()) {
  return useSession<Partial<GithubSessionData>>(event, sessionOptions(config, CMS_SESSION_NAME, SESSION_MAX_AGE))
}

export interface GithubOAuthState {
  state: string
  verifier: string
  redirect: string
}

/** The short sealed session that holds the state of one sign-in attempt. */
export function useGithubOAuthSession(event: H3Event, config: GithubConfig = getGithubConfig()) {
  return useSession<Partial<GithubOAuthState>>(event, sessionOptions(config, CMS_OAUTH_SESSION_NAME, OAUTH_MAX_AGE))
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])
const LOCAL_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

/**
 * The client address of a request that the `nuxt dev` server proxied to its
 * Nitro worker. The worker socket has no remote address, and the dev proxy
 * appends the real client address as the LAST `x-forwarded-for` entry. A
 * client can send its own `x-forwarded-for`, but the proxy still appends the
 * real address after it, so only the last entry counts.
 */
function devProxyClientAddress(header: string | string[] | undefined): string | undefined {
  const value = Array.isArray(header) ? header.join(',') : header
  const last = value?.split(',').map((part) => part.trim()).filter(Boolean).at(-1)
  return last || undefined
}

/**
 * True when the request comes from this machine. It is used only in a dev
 * build with the `fs` store (see `loadSession`).
 *
 * - A direct connection: the socket address must be a loopback address, and
 *   the request must have no `x-forwarded-for` or `forwarded` header (a proxy
 *   or a tunnel forwarded it).
 * - The `nuxt dev` worker: the socket has no address. The last
 *   `x-forwarded-for` entry, which the dev proxy appends, must be a loopback
 *   address.
 *
 * In both cases the `Host` header must name this machine. This blocks DNS
 * rebinding and tunnels.
 */
export function isLocalRequest(event: H3Event): boolean {
  const req = event.node?.req
  if (!req) {
    return false
  }
  const address = req.socket?.remoteAddress
  if (address) {
    if (!LOCAL_ADDRESSES.has(address) || req.headers['x-forwarded-for'] || req.headers.forwarded) {
      return false
    }
  } else {
    const client = devProxyClientAddress(req.headers['x-forwarded-for'])
    if (!client || !LOCAL_ADDRESSES.has(client) || req.headers.forwarded) {
      return false
    }
  }
  const host = String(req.headers.host ?? '').toLowerCase()
  const name = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0]!
  return LOCAL_HOSTS.has(name)
}

const refreshing = new Map<string, Promise<OAuthTokens>>()
/** Fresh results by the refresh token they replaced, for a short time. */
const refreshed = new Map<string, {
 tokens: OAuthTokens
at: number
}>()
/** How long a late request, sent with the old cookie, may reuse a refresh result. */
const REFRESH_REUSE = 60 * 1000

/**
 * One refresh for each refresh token. GitHub rotates the refresh token, so a
 * second use of the old one fails. A browser often sends several requests with
 * the same old cookie. The first call refreshes. A call that runs at the same
 * time shares its promise. A call that comes soon after reuses its result.
 * The results stay in the memory of this server process only.
 */
function refreshOnce(config: GithubConfig, refreshToken: string): Promise<OAuthTokens> {
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
  }).then((tokens) => {
    refreshed.set(refreshToken, { tokens, at: Date.now() })
    return tokens
  }).finally(() => {
    refreshing.delete(refreshToken)
  })
  refreshing.set(refreshToken, promise)
  return promise
}

function isSessionData(data: Partial<GithubSessionData>): data is GithubSessionData {
  return Boolean(data.user && typeof data.user.login === 'string' && typeof data.token === 'string' && data.token !== ''
    && Array.isArray(data.capabilities) && typeof data.checkedAt === 'number')
}

async function loadSession(event: H3Event, config: GithubConfig): Promise<GithubSession | null> {
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

  if (current.expiresAt !== undefined && current.expiresAt - REFRESH_MARGIN < Date.now()) {
    if (!current.refreshToken || (current.refreshExpiresAt !== undefined && current.refreshExpiresAt < Date.now())) {
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
        // GitHub refused the refresh token. The session is over.
        dropSessionCookie(event, config)
        throw signInRequired()
      }
      console.error('[pluto-github] Could not refresh the GitHub token.', error)
      throw githubUnavailable()
    }
  }

  if (Date.now() - current.checkedAt > RECHECK_AFTER) {
    try {
      const repo = await fetchRepoPermission(current.token, config.repo, { apiUrl: config.apiUrl, fetch: config.fetch })
      const mapped = repo ? mapRepoPermission(repo.permissions) : null
      if (!mapped) {
        // The user lost push access, or the app lost the repo.
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
        // GitHub revoked the token.
        dropSessionCookie(event, config)
        throw signInRequired()
      }
      if (error instanceof PlutoGithubStoreError) {
        // GitHub is down or limits us. We cannot prove the access, so deny
        // this request. The session stays, so the next request tries again.
        console.error('[pluto-github] Could not check the repo permission.', error)
        throw githubUnavailable()
      }
      throw error
    }
  }

  return current
}

/**
 * The signed-in user of this request, or `null`. It refreshes the user token
 * when it ends soon. It checks the repo permission again every 10 minutes.
 * One request runs these steps once. A session that is over gives a 401.
 */
export function getGithubSession(event: H3Event): Promise<GithubSession | null> {
  const context = event.context as Record<string, unknown>
  const memo = context[MEMO_KEY] as Promise<GithubSession | null> | undefined
  if (memo) {
    return memo
  }
  const promise = loadSession(event, getGithubConfig())
  context[MEMO_KEY] = promise
  return promise
}

export async function requireGithubSession(event: H3Event): Promise<GithubSession> {
  const session = await getGithubSession(event)
  if (!session) {
    throw signInRequired()
  }
  return session
}

export async function requireGithubCapability(event: H3Event, capability: string): Promise<GithubSession> {
  const session = await requireGithubSession(event)
  if (!session.capabilities.includes('*') && !session.capabilities.includes(capability)) {
    throw createPlutoError({
      statusCode: 403,
      message: 'You do not have permission to do this.',
      key: 'pluto.github.errors.forbidden',
      params: { capability },
    })
  }
  return session
}

/** Starts a session after a sign-in. */
export async function setGithubSession(event: H3Event, data: GithubSessionData): Promise<void> {
  const session = await useGithubSession(event)
  await session.update(data)
  delete (event.context as Record<string, unknown>)[MEMO_KEY]
}

/** Deletes the cookie. It works even when the session password is missing. */
function dropSessionCookie(event: H3Event, config: GithubConfig): void {
  const context = event.context as Record<string, unknown>
  delete (context.sessions as Record<string, unknown> | undefined)?.[CMS_SESSION_NAME]
  deleteCookie(event, CMS_SESSION_NAME, { httpOnly: true, sameSite: 'lax', secure: !config.dev, path: '/' })
}

/**
 * Ends the session. Later reads in the same request see a signed-out user.
 */
export function clearGithubSession(event: H3Event, config: GithubConfig = getGithubConfig()): void {
  dropSessionCookie(event, config)
  const context = event.context as Record<string, unknown>
  context[MEMO_KEY] = Promise.resolve(null)
}
