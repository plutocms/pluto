import type { GithubFetch } from './client'
import { Buffer } from 'node:buffer'
import { createPrivateKey, createSign } from 'node:crypto'
import { createPlutoError } from '../../../../../server/utils/pluto-error'
import { githubRest } from './client'

/** Renew the installation token when it ends in less than this many ms. */
const RENEW_MARGIN = 5 * 60 * 1000

export interface AppTokenOptions {
  /** `owner/name`. */
  repo: string
  apiUrl?: string
  appId: string
  /** The App private key in PEM. A literal `\n` (two characters) stands for a new line. */
  privateKey: string
  /** A read-only token. When set, it replaces the installation token. */
  readToken?: string
  fetch?: GithubFetch
  now?: () => number
}

export interface AppTokenProvider {
  /** The token for anonymous public reads. Throws a 503 when nothing is set up. */
  getReadToken: () => Promise<string>
}

/** Turns the `\n` escapes of an env var into real new lines. */
export function normalizePem(value: string): string {
  return value.trim().replace(/\\n/g, '\n')
}

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url')
}

/**
 * Signs the JWT of a GitHub App (RS256). `iat` is 60 seconds in the past to
 * allow clock drift. The token lives 9 minutes. GitHub allows 10 at most.
 */
export function createAppJwt(options: {
 appId: string
privateKey: string
now?: () => number
}): string {
  const seconds = Math.floor((options.now ?? Date.now)() / 1000)
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64Url(JSON.stringify({ iat: seconds - 60, exp: seconds + 540, iss: options.appId }))
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${payload}`)
  const signature = signer.sign(createPrivateKey(normalizePem(options.privateKey))).toString('base64url')
  return `${header}.${payload}.${signature}`
}

function unavailable() {
  return createPlutoError({
    statusCode: 503,
    message: 'GitHub did not answer as expected. Try again.',
    key: 'pluto.cms.errors.githubUnavailable',
  })
}

/**
 * Gives the token for anonymous reads of the public site. A read-only token
 * from `githubReadToken` wins. Without it, the provider signs an App JWT,
 * finds the installation on the repo and asks for an installation token that
 * can only read contents on this one repo. It keeps that token in memory
 * until 5 minutes before it ends. With no credentials at all, it throws a 503
 * and logs the cause. It never throws when it is built.
 */
export function createAppTokenProvider(options: AppTokenOptions): AppTokenProvider {
  const now = options.now ?? Date.now
  const [, name = ''] = options.repo.split('/')
  let installationId: number | undefined
  let cached: {
 token: string
expiresAt: number
} | undefined
  let inFlight: Promise<string> | undefined
  let warned = false

  function fail(reason: string, error?: unknown): never {
    if (!warned) {
      warned = true
      console.error(`[pluto-cms] Anonymous reads are off: ${reason}`, error ?? '')
    }
    throw unavailable()
  }

  async function mint(): Promise<string> {
    let jwt: string
    try {
      jwt = createAppJwt({ appId: options.appId, privateKey: options.privateKey, now })
    } catch (error) {
      return fail('the GitHub App private key is not valid.', error)
    }
    const transport = { apiUrl: options.apiUrl, fetch: options.fetch, token: jwt }
    try {
      if (installationId === undefined) {
        const found = await githubRest<{
 id: number
}>(`/repos/${options.repo}/installation`, transport)
        installationId = found.data.id
      }
      const created = await githubRest<{
 token: string
expires_at: string
}>(
        `/app/installations/${installationId}/access_tokens`,
        { ...transport, method: 'POST', body: { repositories: [name], permissions: { contents: 'read' } } }
      )
      const expiresAt = Date.parse(created.data.expires_at)
      cached = { token: created.data.token, expiresAt: Number.isFinite(expiresAt) ? expiresAt : now() + 3600_000 }
      warned = false
      return cached.token
    } catch (error) {
      // The installation may be gone or new. Look it up again next time.
      installationId = undefined
      return fail('GitHub did not give an installation token. Install the App on the repo.', error)
    }
  }

  return {
    async getReadToken() {
      if (options.readToken) {
        return options.readToken
      }
      if (!options.appId || !options.privateKey) {
        return fail('set NUXT_PLUTO_CMS_GITHUB_APP_ID and NUXT_PLUTO_CMS_GITHUB_PRIVATE_KEY, or NUXT_PLUTO_CMS_GITHUB_READ_TOKEN.')
      }
      if (cached && cached.expiresAt - RENEW_MARGIN > now()) {
        return cached.token
      }
      inFlight ??= mint().finally(() => {
        inFlight = undefined
      })
      return inFlight
    },
  }
}
