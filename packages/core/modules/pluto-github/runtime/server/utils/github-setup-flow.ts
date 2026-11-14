import type { H3Event } from 'h3'
import type { SetupCheck } from './github-app-setup'
import type { GithubConfig } from './github-config'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import {
  createError,
  deleteCookie,
  getCookie,
  getQuery,
  getRequestHeader,
  getRequestURL,
  setCookie,
  setResponseHeader,
  setResponseStatus,
} from 'h3'
import { usePlutoServerTranslator } from '../../../../../server/utils/pluto-i18n'
import { createAppJwt } from '../github/app-token'
import { githubRest } from '../github/client'
import { PlutoGithubStoreError } from '../store/errors'
import {
  AUTH_CALLBACK_PATH,
  buildAppManifest,
  buildEnvEntries,
  computeSetupChecks,
  firstLanguage,
  formatEnvBlock,
  installUrl,
  isEnvIgnored,
  manifestAppName,
  manifestFormAction,
  needsInstallationCheck,
  parseConversion,
  repoOwner,
  SETUP_BASE_PATH,
  SETUP_STATE_COOKIE,
  SETUP_STATE_MAX_AGE,
  updateEnvText,
} from './github-app-setup'
import { getGithubConfig } from './github-config'
import { oauthBaseUrl, randomToken, safeEqual } from './github-oauth'
import {
  renderErrorPage,
  renderResultPage,
  renderStartPage,
} from './github-setup-pages'
import { enforceAuthRateLimit } from './rate-limit'
import { getGithubSession, isLocalRequest } from './session'

function siteOrigin(event: H3Event): string {
  return getRequestURL(event, { xForwardedHost: true, xForwardedProto: true })
    .origin
}

function noStore(event: H3Event): void {
  setResponseHeader(event, 'Cache-Control', 'no-store')
}

function inputOf(config: GithubConfig) {
  return {
    repo: config.repo,
    sessionPassword: config.sessionPassword,
    appId: config.appId,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    privateKey: config.privateKey,
  }
}

function isDevLocal(event: H3Event, config: GithubConfig): boolean {
  return config.dev && isLocalRequest(event)
}

function assertSetupAllowed(event: H3Event, config: GithubConfig): void {
  if (isDevLocal(event, config)) {
    return
  }
  if (computeSetupChecks(inputOf(config)).ready) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }
}

async function appIsInstalled(config: GithubConfig): Promise<boolean> {
  try {
    const jwt = createAppJwt({
      appId: config.appId,
      privateKey: config.privateKey,
    })
    await githubRest(`/repos/${config.repo}/installation`, {
      token: jwt,
      apiUrl: config.apiUrl,
      fetch: config.fetch,
    })
    return true
  } catch {
    return false
  }
}

export interface SetupStatus {
  ready: boolean
  repo?: string
  storage?: 'github' | 'fs'
  callbackUrl?: string
  canCreateApp?: boolean
  checks?: SetupCheck[]
}

// A ready site tells an anonymous caller nothing more than `ready`.
export async function handleSetupStatus(event: H3Event): Promise<SetupStatus> {
  enforceAuthRateLimit(event)
  noStore(event)
  const config = getGithubConfig()
  const base = computeSetupChecks(inputOf(config))
  const devLocal = isDevLocal(event, config)

  let detailed = devLocal || !base.ready
  if (!detailed) {
    try {
      detailed = (await getGithubSession(event)) !== null
    } catch {
      detailed = false
    }
  }
  if (!detailed) {
    return { ready: true }
  }

  const input = inputOf(config)
  const installed = needsInstallationCheck(input)
    ? await appIsInstalled(config)
    : undefined
  const { ready, checks } = computeSetupChecks({ ...input, installed })
  return {
    ready,
    repo: config.repo,
    storage: config.storage,
    callbackUrl: `${siteOrigin(event)}${AUTH_CALLBACK_PATH}`,
    canCreateApp: devLocal || !ready,
    checks,
  }
}

async function pageTranslator(event: H3Event) {
  const translator = await usePlutoServerTranslator(
    firstLanguage(getRequestHeader(event, 'accept-language'))
  )
  return {
    lang: translator.locale,
    t: translator.t,
  }
}

function sendHtml(event: H3Event, html: string, status = 200): string {
  noStore(event)
  setResponseStatus(event, status)
  setResponseHeader(event, 'Content-Type', 'text/html; charset=utf-8')
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  setResponseHeader(event, 'Referrer-Policy', 'no-referrer')
  setResponseHeader(event, 'X-Robots-Tag', 'noindex')
  return html
}

async function lookupOwnerType(
  config: GithubConfig
): Promise<string | undefined> {
  const owner = repoOwner(config.repo)
  if (!owner) {
    return undefined
  }
  try {
    const { data } = await githubRest<{
      type?: string
    }>(`/users/${encodeURIComponent(owner)}`, {
      apiUrl: config.apiUrl,
      fetch: config.fetch,
    })
    return data?.type
  } catch {
    return undefined
  }
}

export async function handleSetupStart(event: H3Event): Promise<string> {
  enforceAuthRateLimit(event)
  const config = getGithubConfig()
  assertSetupAllowed(event, config)

  const origin = siteOrigin(event)
  const state = randomToken(24)
  setCookie(event, SETUP_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: origin.startsWith('https:'),
    maxAge: SETUP_STATE_MAX_AGE,
    path: SETUP_BASE_PATH,
  })

  const manifest = buildAppManifest({
    siteName: config.siteName || repoName(config.repo),
    origin,
  })
  const action = manifestFormAction({
    webBase: oauthBaseUrl(config.apiUrl),
    owner: repoOwner(config.repo),
    ownerType: await lookupOwnerType(config),
    state,
  })
  const { t, lang } = await pageTranslator(event)
  return sendHtml(
    event,
    renderStartPage({
      t,
      lang,
      action,
      manifest: JSON.stringify(manifest),
      appName: manifestAppName(config.siteName || repoName(config.repo)),
    })
  )
}

function repoName(repo: string): string {
  return repo.split('/')[1] ?? ''
}

async function writeEnvFile(
  config: GithubConfig,
  entries: Array<[string, string]>
): Promise<{
  saved: boolean
  failed: boolean
  notIgnored: boolean
}> {
  const root = config.rootDir || process.cwd()
  try {
    let current = ''
    try {
      current = await readFile(join(root, '.env'), 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
    await writeFile(join(root, '.env'), updateEnvText(current, entries), 'utf8')
  } catch (error) {
    console.error(
      `[pluto-github] Could not write the .env file (${(error as NodeJS.ErrnoException).code ?? 'error'}).`
    )
    return { saved: false, failed: true, notIgnored: false }
  }
  let ignored = false
  try {
    ignored = isEnvIgnored(await readFile(join(root, '.gitignore'), 'utf8'))
  } catch {
    ignored = false
  }
  return { saved: true, failed: false, notIgnored: !ignored }
}

export async function handleSetupCallback(event: H3Event): Promise<string> {
  enforceAuthRateLimit(event)
  const config = getGithubConfig()
  assertSetupAllowed(event, config)

  const { t, lang } = await pageTranslator(event)
  const retryUrl = `${SETUP_BASE_PATH}/start`
  const fail = (reason: 'state' | 'github', status: number) =>
    sendHtml(event, renderErrorPage({ t, lang, reason, retryUrl }), status)

  const query = getQuery(event)
  const saved = getCookie(event, SETUP_STATE_COOKIE)
  deleteCookie(event, SETUP_STATE_COOKIE, { path: SETUP_BASE_PATH })
  if (
    !saved ||
    typeof query.state !== 'string' ||
    !safeEqual(saved, query.state)
  ) {
    return fail('state', 400)
  }
  if (typeof query.code !== 'string' || !/^[\w-]{1,128}$/.test(query.code)) {
    return fail('github', 400)
  }

  let converted
  try {
    const response = await githubRest(
      `/app-manifests/${query.code}/conversions`,
      {
        method: 'POST',
        apiUrl: config.apiUrl,
        fetch: config.fetch,
      }
    )
    converted = parseConversion(response.data)
  } catch (error) {
    console.error(
      `[pluto-github] GitHub did not convert the App manifest (${error instanceof PlutoGithubStoreError ? error.code : 'error'}).`
    )
    return fail('github', 502)
  }
  if (!converted) {
    console.error(
      '[pluto-github] GitHub answered the App manifest without the expected fields.'
    )
    return fail('github', 502)
  }

  const newPassword =
    config.sessionPassword.length >= 32 ? undefined : randomToken(32)
  const entries = buildEnvEntries(converted, newPassword)
  const devLocal = isDevLocal(event, config)
  const env = devLocal
    ? await writeEnvFile(config, entries)
    : { saved: false, failed: false, notIgnored: false }

  return sendHtml(
    event,
    renderResultPage({
      t,
      lang,
      appName: converted.slug,
      envBlock: formatEnvBlock(entries),
      installUrl: installUrl(oauthBaseUrl(config.apiUrl), converted.slug),
      envSaved: env.saved,
      envFailed: env.failed,
      envNotIgnored: env.notIgnored,
      dev: devLocal,
      signInUrl: '/admin/login',
    })
  )
}
