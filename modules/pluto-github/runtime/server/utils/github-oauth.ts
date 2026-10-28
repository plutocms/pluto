import type { GithubFetch } from '../github/client'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { listContentTypes } from '../../../../../server/utils/pluto-content'
import { plutoGithubPostType } from '../../shared/post-type'
import {
  defaultGithubFetch,
  GITHUB_API_URL,
  githubRest,
} from '../github/client'
import { PlutoGithubStoreError } from '../store/errors'

export interface GithubTransportOptions {
  apiUrl?: string
  fetch?: GithubFetch
}

export interface OAuthTokens {
  accessToken: string
  refreshToken?: string
  /** Epoch ms. Unset when the token does not expire. */
  expiresAt?: number
  refreshExpiresAt?: number
}

export interface GithubUser {
  id: number
  login: string
  name: string | null
  avatarUrl: string
}

export interface RepoPermissions {
  admin?: boolean
  maintain?: boolean
  push?: boolean
  triage?: boolean
  pull?: boolean
}

export interface RepoInfo {
  name: string
  private: boolean
  permissions: RepoPermissions
}

export type GithubPermissionLevel = 'admin' | 'maintain' | 'push'

/** GitHub answered an OAuth call with an error. The code is the `error` field of GitHub. */
export class PlutoGithubOAuthError extends Error {
  readonly code: string

  constructor(code: string, description?: string) {
    super(description ? `${code}: ${description}` : code)
    this.name = 'PlutoGithubOAuthError'
    this.code = code
  }
}

/**
 * The web base URL for the OAuth endpoints. GitHub.com uses
 * `https://github.com`. A GitHub Enterprise Server API URL ends with
 * `/api/v3`. Its web URL is the same host without that suffix. Any other
 * value falls back to `https://github.com`.
 */
export function oauthBaseUrl(apiUrl: string = GITHUB_API_URL): string {
  const base = apiUrl.replace(/\/+$/, '')
  if (base === GITHUB_API_URL) {
    return 'https://github.com'
  }
  if (base.endsWith('/api/v3')) {
    return base.slice(0, -'/api/v3'.length)
  }
  return 'https://github.com'
}

/** A random URL-safe string made of `bytes` random bytes. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

/** A PKCE pair. The challenge is the S256 hash of the verifier. */
export function createPkcePair(): {
  verifier: string
  challenge: string
} {
  const verifier = randomToken(32)
  return {
    verifier,
    challenge: createHash('sha256').update(verifier).digest('base64url'),
  }
}

/** Compares two strings in constant time. A different length is safe too. */
export function safeEqual(a: string, b: string): boolean {
  const left = createHash('sha256').update(a).digest()
  const right = createHash('sha256').update(b).digest()
  return timingSafeEqual(left, right) && a.length === b.length
}

/** True when the text holds a control character (code 0 to 31, or 127). */
function hasControlCharacter(text: string): boolean {
  return [...text].some((char) => {
    const code = char.charCodeAt(0)
    return code < 32 || code === 127
  })
}

/**
 * Checks a post-login redirect target. Only a path on this site is valid. It
 * must start with one `/`. It must not start with `//` or `/\`. It must hold
 * no backslash, no control character and no other origin. Anything else gives
 * the fallback.
 */
export function safeRedirect(value: unknown, fallback = '/admin/home'): string {
  if (typeof value !== 'string' || value === '' || value.length > 2048) {
    return fallback
  }
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\')
  ) {
    return fallback
  }
  // A tab or a new line can hide a second slash from the check above.
  if (hasControlCharacter(value)) {
    return fallback
  }
  // Resolve against a fake origin. A target that leaves it is not a local path.
  try {
    if (
      new URL(value, 'http://pluto.invalid').origin !== 'http://pluto.invalid'
    ) {
      return fallback
    }
  } catch {
    return fallback
  }
  return value
}

export function buildAuthorizeUrl(options: {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
  apiUrl?: string
}): string {
  const url = new URL(`${oauthBaseUrl(options.apiUrl)}/login/oauth/authorize`)
  url.searchParams.set('client_id', options.clientId)
  url.searchParams.set('redirect_uri', options.redirectUri)
  url.searchParams.set('state', options.state)
  // PKCE. Recent GitHub versions support it for the web flow of a GitHub App.
  // A server that does not know these two fields ignores them. `state` still
  // guards the flow in that case.
  url.searchParams.set('code_challenge', options.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

interface TokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number | string
  refresh_token_expires_in?: number | string
  error?: string
  error_description?: string
}

async function requestToken(
  body: Record<string, string>,
  options: GithubTransportOptions & {
    now?: () => number
  }
): Promise<OAuthTokens> {
  const send = options.fetch ?? defaultGithubFetch
  const response = await send(
    `${oauthBaseUrl(options.apiUrl)}/login/oauth/access_token`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'plutocms',
      },
      body: JSON.stringify(body),
    }
  )
  const data = (response.data ?? {}) as TokenResponse

  if (data.error) {
    throw new PlutoGithubOAuthError(data.error, data.error_description)
  }
  if (
    response.status >= 400 ||
    typeof data.access_token !== 'string' ||
    data.access_token === ''
  ) {
    throw new PlutoGithubStoreError(
      'github',
      `GitHub did not return a token. Status ${response.status}.`,
      {
        status: response.status,
      }
    )
  }

  const now = (options.now ?? Date.now)()
  const later = (value: unknown): number | undefined => {
    const seconds = Number(value)
    return value !== undefined && Number.isFinite(seconds) && seconds > 0
      ? now + seconds * 1000
      : undefined
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || undefined,
    expiresAt: later(data.expires_in),
    refreshExpiresAt: later(data.refresh_token_expires_in),
  }
}

export function exchangeCode(
  options: GithubTransportOptions & {
    clientId: string
    clientSecret: string
    code: string
    codeVerifier: string
    redirectUri: string
    now?: () => number
  }
): Promise<OAuthTokens> {
  return requestToken(
    {
      client_id: options.clientId,
      client_secret: options.clientSecret,
      code: options.code,
      redirect_uri: options.redirectUri,
      code_verifier: options.codeVerifier,
    },
    options
  )
}

export function refreshUserToken(
  options: GithubTransportOptions & {
    clientId: string
    clientSecret: string
    refreshToken: string
    now?: () => number
  }
): Promise<OAuthTokens> {
  return requestToken(
    {
      client_id: options.clientId,
      client_secret: options.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: options.refreshToken,
    },
    options
  )
}

export async function fetchUser(
  token: string,
  options: GithubTransportOptions = {}
): Promise<GithubUser> {
  const { data } = await githubRest<{
    id: number
    login: string
    name?: string | null
    avatar_url?: string
  }>('/user', { token, ...options })
  return {
    id: data.id,
    login: data.login,
    name: data.name ?? null,
    avatarUrl: data.avatar_url ?? '',
  }
}

/**
 * Reads the repo with the USER token. GitHub answers with the permissions of
 * that user. A repo the user cannot see, or the app cannot reach, gives a
 * 404. That returns `null`.
 */
export async function fetchRepoPermission(
  token: string,
  repo: string,
  options: GithubTransportOptions = {}
): Promise<RepoInfo | null> {
  try {
    const { data } = await githubRest<{
      name: string
      private?: boolean
      permissions?: RepoPermissions
    }>(`/repos/${repo}`, { token, ...options })
    return {
      name: data.name,
      private: data.private !== false,
      permissions: data.permissions ?? {},
    }
  } catch (error) {
    if (error instanceof PlutoGithubStoreError && error.code === 'not-found') {
      return null
    }
    throw error
  }
}

/**
 * Maps a repo permission to capabilities. Admin and maintain get every
 * capability. Push gets the read, write, publish and delete keys of every
 * registered content type (the post type when none is registered). A lower permission gets `null`: it cannot sign in.
 */
export function mapRepoPermission(permissions: RepoPermissions | undefined): {
  permission: GithubPermissionLevel
  capabilities: string[]
} | null {
  if (!permissions) {
    return null
  }
  if (permissions.admin) {
    return { permission: 'admin', capabilities: ['*'] }
  }
  if (permissions.maintain) {
    return { permission: 'maintain', capabilities: ['*'] }
  }
  if (permissions.push) {
    // Every registered type counts. The post type is the fallback when none is registered.
    const registered = listContentTypes()
    const types = registered.length > 0 ? registered : [plutoGithubPostType]
    const keys = types.flatMap((type) => {
      const { read, write, publish, delete: remove } = type.capabilities ?? {}
      return [read, write, publish, remove]
    })
    return {
      permission: 'push',
      capabilities: [
        ...new Set(
          keys.filter((key): key is string => typeof key === 'string')
        ),
      ],
    }
  }
  return null
}
