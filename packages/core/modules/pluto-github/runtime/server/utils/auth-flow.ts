import type { H3Event } from 'h3'
import type { GithubSessionData } from './session'
import {
  getQuery,
  getRequestURL,
  sendRedirect,
  setResponseHeader,
  setResponseStatus,
} from 'h3'
import { getGithubConfig } from './github-config'
import {
  buildAuthorizeUrl,
  createPkcePair,
  exchangeCode,
  fetchRepoPermission,
  fetchUser,
  mapRepoPermission,
  randomToken,
  safeEqual,
  safeRedirect,
} from './github-oauth'
import { enforceAuthRateLimit } from './rate-limit'
import {
  authNotConfigured,
  clearGithubSession,
  getGithubSession,
  setGithubSession,
  useGithubOAuthSession,
} from './session'

export const CALLBACK_PATH = '/api/_pluto/auth/github/callback'
export const LOGIN_PAGE = '/admin/login'

function noStore(event: H3Event): void {
  setResponseHeader(event, 'Cache-Control', 'no-store')
}

function callbackUrl(event: H3Event): string {
  return `${getRequestURL(event).origin}${CALLBACK_PATH}`
}

function loginError(event: H3Event, reason: string) {
  return sendRedirect(event, `${LOGIN_PAGE}?error=${reason}`, 302)
}

/** Starts the GitHub sign-in. It saves `state`, the PKCE verifier and the target in a short sealed session. */
export async function handleLogin(event: H3Event) {
  enforceAuthRateLimit(event)
  noStore(event)
  const config = getGithubConfig()
  if (!config.clientId || !config.clientSecret) {
    console.error(
      '[pluto-github] NUXT_PLUTO_GITHUB_CLIENT_ID and NUXT_PLUTO_GITHUB_CLIENT_SECRET are not set.'
    )
    throw authNotConfigured()
  }

  const redirect = safeRedirect(getQuery(event).redirect)
  const state = randomToken(32)
  const pkce = createPkcePair()

  const oauth = await useGithubOAuthSession(event, config)
  await oauth.update({ state, verifier: pkce.verifier, redirect })

  return sendRedirect(
    event,
    buildAuthorizeUrl({
      clientId: config.clientId,
      redirectUri: callbackUrl(event),
      state,
      codeChallenge: pkce.challenge,
      apiUrl: config.apiUrl,
    }),
    302
  )
}

/** Ends the GitHub sign-in. It checks `state`, trades the code, checks the repo permission and starts the session. */
export async function handleCallback(event: H3Event) {
  enforceAuthRateLimit(event)
  noStore(event)
  const config = getGithubConfig()
  if (!config.clientId || !config.clientSecret) {
    throw authNotConfigured()
  }

  const query = getQuery(event)
  const oauth = await useGithubOAuthSession(event, config)
  const saved = { ...oauth.data }
  // The state works once. Clear it before any check, so a replay fails.
  await oauth.clear()

  if (
    !saved.state ||
    !saved.verifier ||
    typeof query.state !== 'string' ||
    !safeEqual(saved.state, query.state)
  ) {
    return loginError(event, 'state')
  }
  if (typeof query.error === 'string') {
    return loginError(event, 'denied')
  }
  if (typeof query.code !== 'string' || query.code === '') {
    return loginError(event, 'github')
  }

  const transport = { apiUrl: config.apiUrl, fetch: config.fetch }
  let data: GithubSessionData
  try {
    const tokens = await exchangeCode({
      ...transport,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      code: query.code,
      codeVerifier: saved.verifier,
      redirectUri: callbackUrl(event),
    })
    const user = await fetchUser(tokens.accessToken, transport)
    // The USER token reads the repo. A repo the user or the App cannot see gives a 404.
    const repo = await fetchRepoPermission(
      tokens.accessToken,
      config.repo,
      transport
    )
    if (!repo) {
      return loginError(event, 'not_installed')
    }
    const mapped = mapRepoPermission(repo.permissions)
    if (!mapped) {
      return loginError(event, 'forbidden')
    }
    if (
      config.allowedUsers.length > 0 &&
      !config.allowedUsers.includes(user.login.toLowerCase())
    ) {
      return loginError(event, 'forbidden')
    }
    data = {
      user,
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      refreshExpiresAt: tokens.refreshExpiresAt,
      permission: mapped.permission,
      capabilities: mapped.capabilities,
      checkedAt: Date.now(),
      repoPrivate: repo.private,
    }
  } catch (error) {
    console.error('[pluto-github] GitHub sign-in failed.', error)
    return loginError(event, 'github')
  }

  await setGithubSession(event, data)
  return sendRedirect(event, safeRedirect(saved.redirect), 302)
}

/** Ends the session. */
export function handleLogout(event: H3Event) {
  noStore(event)
  clearGithubSession(event)
  setResponseStatus(event, 204)
  return null
}

/** What the browser may know about the session. It never has a token. */
export async function handleSession(event: H3Event) {
  noStore(event)
  const config = getGithubConfig()
  let session
  try {
    session = await getGithubSession(event)
  } catch (error) {
    // A session that is over gives `{ user: null }`. Its cookie is already cleared.
    if (
      (
        error as {
          statusCode?: number
        }
      )?.statusCode === 401
    ) {
      return { user: null }
    }
    throw error
  }
  if (!session) {
    return { user: null }
  }
  return {
    user: {
      id: session.user.id,
      login: session.user.login,
      name: session.user.name,
      avatarUrl: session.user.avatarUrl,
    },
    capabilities: session.capabilities,
    repo: { name: config.repo, private: session.repoPrivate },
  }
}
