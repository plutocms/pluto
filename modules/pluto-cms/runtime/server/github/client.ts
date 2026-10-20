import { ofetch } from 'ofetch'
import { PlutoCmsConflictError, PlutoCmsStoreError } from '../store/errors'

export const GITHUB_API_URL = 'https://api.github.com'
const API_VERSION = '2022-11-28'

export interface GithubFetchInit {
  method: string
  headers: Record<string, string>
  body?: string
}

export interface GithubFetchResponse {
  status: number
  headers: {
 get: (name: string) => string | null
}
  /** The parsed JSON body, or the text body for a `sha` accept. */
  data: unknown
}

/** The transport. Tests inject a stub. The default uses `ofetch`. */
export type GithubFetch = (url: string, init: GithubFetchInit) => Promise<GithubFetchResponse>

/** The default transport. It never throws on an HTTP error status. */
export const defaultGithubFetch: GithubFetch = async (url, init) => {
  const wantsText = (init.headers.Accept ?? '').includes('.sha')
  const response = await ofetch.raw(url, {
    method: init.method as 'GET',
    headers: init.headers,
    body: init.body,
    ignoreResponseError: true,
    responseType: wantsText ? 'text' : 'json',
  })
  return { status: response.status, headers: response.headers, data: response._data }
}

export interface GithubRequestOptions {
  token?: string
  apiUrl?: string
  fetch?: GithubFetch
}

export interface GithubRestOptions extends GithubRequestOptions {
  method?: string
  body?: unknown
  etag?: string
  accept?: string
}

export interface GithubRestResult<T> {
  status: number
  data: T
  etag?: string
}

function baseHeaders(token: string | undefined, accept: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': accept,
    'User-Agent': 'plutocms',
    'X-GitHub-Api-Version': API_VERSION,
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

function messageOf(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
    return data.message
  }
  return fallback
}

/** Maps a failed HTTP response to a typed error. */
export function errorFromResponse(response: GithubFetchResponse): PlutoCmsStoreError {
  const { status, headers, data } = response
  const message = messageOf(data, `GitHub answered with status ${status}.`)

  if (status === 401) {
    return new PlutoCmsStoreError('auth', message, { status })
  }

  const remaining = headers.get('x-ratelimit-remaining')
  const retryHeader = headers.get('retry-after')
  const isRateLimit = status === 429
    || (status === 403 && (remaining === '0' || retryHeader !== null || /rate limit/i.test(message)))
  if (isRateLimit) {
    let retryAfter: number | undefined
    if (retryHeader !== null && Number.isFinite(Number(retryHeader))) {
      retryAfter = Number(retryHeader)
    } else {
      const reset = Number(headers.get('x-ratelimit-reset'))
      if (Number.isFinite(reset) && reset > 0) {
        retryAfter = Math.max(0, Math.ceil(reset - Date.now() / 1000))
      }
    }
    return new PlutoCmsStoreError('rate-limit', message, { status, retryAfter })
  }

  if (status === 403) {
    return new PlutoCmsStoreError('forbidden', message, { status })
  }
  if (status === 404) {
    return new PlutoCmsStoreError('not-found', message, { status })
  }
  return new PlutoCmsStoreError('github', message, { status })
}

/** A REST call. A 304 returns `status: 304` and does not throw. */
export async function githubRest<T = unknown>(
  path: string,
  options: GithubRestOptions = {}
): Promise<GithubRestResult<T>> {
  const apiUrl = (options.apiUrl ?? GITHUB_API_URL).replace(/\/+$/, '')
  const headers = baseHeaders(options.token, options.accept ?? 'application/vnd.github+json')
  if (options.etag) {
    headers['If-None-Match'] = options.etag
  }
  let body: string | undefined
  if (options.body !== undefined) {
    body = JSON.stringify(options.body)
    headers['Content-Type'] = 'application/json'
  }
  const send = options.fetch ?? defaultGithubFetch
  const response = await send(`${apiUrl}${path}`, { method: options.method ?? 'GET', headers, body })

  if (response.status === 304) {
    return { status: 304, data: undefined as T, etag: options.etag }
  }
  if (response.status >= 400) {
    throw errorFromResponse(response)
  }
  return { status: response.status, data: response.data as T, etag: response.headers.get('etag') ?? undefined }
}

/** The GraphQL endpoint for an API URL. GitHub Enterprise uses `/api/v3` for REST. */
export function graphqlUrl(apiUrl: string): string {
  const base = apiUrl.replace(/\/+$/, '')
  return base.endsWith('/api/v3') ? `${base.slice(0, -'/v3'.length)}/graphql` : `${base}/graphql`
}

interface GraphqlError {
  type?: string
  message?: string
}

const STALE_PATTERN = /expectedHeadOid|is not the latest|STALE_DATA|stale/i

/** Maps GraphQL `errors[]` to a typed error. */
export function errorFromGraphql(errors: GraphqlError[]): PlutoCmsStoreError {
  const message = errors.map((error) => error.message ?? 'GraphQL error').join(' ')
  if (errors.some((error) => error.type === 'STALE_DATA' || STALE_PATTERN.test(error.message ?? ''))) {
    return new PlutoCmsConflictError()
  }
  if (errors.some((error) => error.type === 'RATE_LIMITED' || /rate limit/i.test(error.message ?? ''))) {
    return new PlutoCmsStoreError('rate-limit', message, { status: 403 })
  }
  if (errors.some((error) => error.type === 'NOT_FOUND')) {
    return new PlutoCmsStoreError('not-found', message, { status: 404 })
  }
  if (errors.some((error) => error.type === 'FORBIDDEN' || error.type === 'INSUFFICIENT_SCOPES')) {
    return new PlutoCmsStoreError('forbidden', message, { status: 403 })
  }
  return new PlutoCmsStoreError('github', message)
}

/** A GraphQL call. A GraphQL error throws a typed error. */
export async function githubGraphql<T = unknown>(
  query: string,
  variables: Record<string, unknown>,
  options: GithubRequestOptions = {}
): Promise<T> {
  const headers = baseHeaders(options.token, 'application/json')
  headers['Content-Type'] = 'application/json'
  const send = options.fetch ?? defaultGithubFetch
  const response = await send(graphqlUrl(options.apiUrl ?? GITHUB_API_URL), {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  })
  if (response.status >= 400) {
    throw errorFromResponse(response)
  }
  const payload = response.data as {
 data?: T | null
errors?: GraphqlError[]
} | undefined
  if (payload?.errors && payload.errors.length > 0) {
    throw errorFromGraphql(payload.errors)
  }
  return payload?.data as T
}
