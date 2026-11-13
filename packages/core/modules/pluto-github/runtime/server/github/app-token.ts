import type { GithubFetch } from './client'
import { Buffer } from 'node:buffer'
import { createPrivateKey, createSign } from 'node:crypto'
import { createPlutoError } from '../../../../../server/utils/pluto-error'
import { githubRest } from './client'

const RENEW_MARGIN = 5 * 60 * 1000

export interface AppTokenOptions {
  repo: string
  apiUrl?: string
  appId: string
  privateKey: string
  readToken?: string
  fetch?: GithubFetch
  now?: () => number
}

export interface AppTokenProvider {
  getReadToken: () => Promise<string>
  getWriteToken: () => Promise<string>
}

export function normalizePem(value: string): string {
  const text = value.trim().replace(/\\n/g, '\n').replace(/\r\n/g, '\n')
  if (text.includes('-----BEGIN')) {
    return text
  }
  const compact = text.replace(/\s+/g, '')
  if (compact !== '' && /^[\w+/=-]+$/.test(compact)) {
    const decoded = Buffer.from(compact, 'base64')
      .toString('utf8')
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n')
      .trim()
    if (decoded.includes('-----BEGIN')) {
      return decoded
    }
  }
  return text
}

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url')
}

export function createAppJwt(options: {
  appId: string
  privateKey: string
  now?: () => number
}): string {
  const seconds = Math.floor((options.now ?? Date.now)() / 1000)
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64Url(
    JSON.stringify({
      iat: seconds - 60,
      exp: seconds + 540,
      iss: options.appId,
    })
  )
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${payload}`)
  const signature = signer
    .sign(createPrivateKey(normalizePem(options.privateKey)))
    .toString('base64url')
  return `${header}.${payload}.${signature}`
}

function unavailable(notConfigured = false) {
  return notConfigured
    ? createPlutoError({
        statusCode: 503,
        message:
          'This site cannot read its content from GitHub yet. Set up the GitHub App in /admin.',
        key: 'pluto.github.errors.notConfigured',
      })
    : createPlutoError({
        statusCode: 503,
        message: 'GitHub did not answer as expected. Try again.',
        key: 'pluto.github.errors.githubUnavailable',
      })
}

export function createAppTokenProvider(
  options: AppTokenOptions
): AppTokenProvider {
  const now = options.now ?? Date.now
  const [, name = ''] = options.repo.split('/')
  let installationId: number | undefined
  const cached: Partial<
    Record<
      'read' | 'write',
      {
        token: string
        expiresAt: number
      }
    >
  > = {}
  const inFlight: Partial<Record<'read' | 'write', Promise<string>>> = {}
  let warned = false

  function fail(
    reason: string,
    error?: unknown,
    notConfigured = false,
    access: 'read' | 'write' = 'read'
  ): never {
    if (access === 'write') {
      throw unavailable(notConfigured)
    }
    if (!warned) {
      warned = true
      console.error(
        `[pluto-github] Anonymous reads are off: ${reason}`,
        error ?? ''
      )
    }
    throw unavailable(notConfigured)
  }

  async function mint(access: 'read' | 'write'): Promise<string> {
    let jwt: string
    try {
      jwt = createAppJwt({
        appId: options.appId,
        privateKey: options.privateKey,
        now,
      })
    } catch (error) {
      return fail(
        'the GitHub App private key is not valid.',
        error,
        false,
        access
      )
    }
    const transport = {
      apiUrl: options.apiUrl,
      fetch: options.fetch,
      token: jwt,
    }
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
      }>(`/app/installations/${installationId}/access_tokens`, {
        ...transport,
        method: 'POST',
        body: { repositories: [name], permissions: { contents: access } },
      })
      const expiresAt = Date.parse(created.data.expires_at)
      const token = {
        token: created.data.token,
        expiresAt: Number.isFinite(expiresAt) ? expiresAt : now() + 3600_000,
      }
      cached[access] = token
      if (access === 'read') {
        warned = false
      }
      return token.token
    } catch (error) {
      installationId = undefined
      return fail(
        'GitHub did not give an installation token. Install the App on the repo.',
        error,
        false,
        access
      )
    }
  }

  function installationToken(access: 'read' | 'write'): Promise<string> {
    const token = cached[access]
    if (token && token.expiresAt - RENEW_MARGIN > now()) {
      return Promise.resolve(token.token)
    }
    inFlight[access] ??= mint(access).finally(() => {
      inFlight[access] = undefined
    })
    return inFlight[access]
  }

  return {
    async getReadToken() {
      if (options.readToken) {
        return options.readToken
      }
      if (!options.appId || !options.privateKey) {
        return fail(
          'set NUXT_PLUTO_GITHUB_APP_ID and NUXT_PLUTO_GITHUB_PRIVATE_KEY, or NUXT_PLUTO_GITHUB_READ_TOKEN.',
          undefined,
          true
        )
      }
      return installationToken('read')
    },
    async getWriteToken() {
      if (!options.appId || !options.privateKey) {
        return fail('no App id or key.', undefined, true, 'write')
      }
      return installationToken('write')
    },
  }
}
