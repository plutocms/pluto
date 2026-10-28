import type { PlutoMailErrorCode } from '../../shared/types/mail'
import { PlutoMailError } from './errors'

const BASE_URL = 'https://api.resend.com'

/** Resend refuses a call with no User-Agent header (403). */
export const RESEND_USER_AGENT = 'PlutoCMS (+https://github.com/plutocms/pluto)'

/** One attempt may take 4 seconds. A send has one retry. */
export const RESEND_TIMEOUT_MS = 4000

export interface ResendClientOptions {
  apiKey: string
  /** Default: the global `fetch`. A test passes a fake. */
  fetch?: typeof fetch
  timeoutMs?: number
  baseUrl?: string
}

export interface ResendRequestOptions {
  body?: unknown
  /** Sent as the `Idempotency-Key` header. */
  idempotencyKey?: string
  /** Retry once, with the same key, after a network error, a timeout or a 5xx. */
  retry?: boolean
}

interface ResendErrorBody {
  name?: string
  message?: string
}

/**
 * Maps a Resend error answer to a mail error code. The English message is
 * fixed per code: it never repeats the provider text, because that text can
 * hold the address of the recipient.
 */
export function mapResendError(
  status: number,
  body: ResendErrorBody | null
): PlutoMailError {
  const name = typeof body?.name === 'string' ? body.name : undefined
  const message = typeof body?.message === 'string' ? body.message : ''
  const options = { status, providerCode: name }

  function error(code: PlutoMailErrorCode, text: string) {
    return new PlutoMailError(code, text, options)
  }

  if (name === 'restricted_api_key') {
    return error(
      'restricted_key',
      'The Resend key can only send emails. This call needs full access.'
    )
  }
  if (
    status === 401 ||
    name === 'invalid_api_key' ||
    name === 'missing_api_key'
  ) {
    return error('invalid_key', 'Resend rejected the API key.')
  }
  if (status === 403) {
    if (/testing emails/i.test(message)) {
      return error(
        'test_sender_only',
        'The From domain is not verified, so Resend sends only to the account owner.'
      )
    }
    if (/not verified/i.test(message)) {
      return error(
        'domain_not_verified',
        'The From domain is not verified in Resend.'
      )
    }
    return error('provider_error', 'Resend refused the request.')
  }
  if (status === 429) {
    return /quota/i.test(name ?? '')
      ? error('quota_exceeded', 'The Resend sending quota is used.')
      : error('rate_limited', 'Resend limits the request rate. Try again soon.')
  }
  if (status === 400 || status === 422) {
    return error('invalid_message', 'Resend rejected the request.')
  }
  return error('provider_error', `Resend failed with status ${status}.`)
}

/**
 * A small Resend API client over plain `fetch`: no SDK. It sets the
 * User-Agent header, a timeout for each attempt, and maps every failure to a
 * `PlutoMailError`. The key never appears in an error.
 */
export function createResendClient(options: ResendClientOptions) {
  const doFetch = options.fetch ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? RESEND_TIMEOUT_MS
  const baseUrl = options.baseUrl ?? BASE_URL

  async function attempt<T>(
    method: string,
    path: string,
    request: ResendRequestOptions
  ): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${options.apiKey}`,
        'User-Agent': RESEND_USER_AGENT,
        Accept: 'application/json',
      }
      if (request.body !== undefined) {
        headers['Content-Type'] = 'application/json'
      }
      if (request.idempotencyKey) {
        headers['Idempotency-Key'] = request.idempotencyKey
      }

      let response: Response
      try {
        response = await doFetch(`${baseUrl}${path}`, {
          method,
          headers,
          body:
            request.body === undefined
              ? undefined
              : JSON.stringify(request.body),
          signal: controller.signal,
        })
      } catch (error) {
        const aborted =
          controller.signal.aborted ||
          (error instanceof Error && error.name === 'AbortError')
        throw aborted
          ? new PlutoMailError('timeout', 'Resend did not answer in time.')
          : new PlutoMailError('network', 'The request did not reach Resend.')
      }

      let payload: unknown = null
      try {
        payload = await response.json()
      } catch {
        // An empty or invalid body: the status still decides.
      }

      if (!response.ok) {
        throw mapResendError(response.status, payload as ResendErrorBody | null)
      }
      return payload as T
    } finally {
      clearTimeout(timer)
    }
  }

  function shouldRetry(error: unknown): boolean {
    if (!(error instanceof PlutoMailError)) {
      return false
    }
    return (
      error.code === 'network' ||
      error.code === 'timeout' ||
      (error.status !== undefined && error.status >= 500)
    )
  }

  return {
    /** Calls the Resend API. Returns the parsed JSON body. Throws a `PlutoMailError`. */
    async request<T = unknown>(
      method: string,
      path: string,
      request: ResendRequestOptions = {}
    ): Promise<T> {
      try {
        return await attempt<T>(method, path, request)
      } catch (error) {
        if (request.retry && shouldRetry(error)) {
          return attempt<T>(method, path, request)
        }
        throw error
      }
    },
  }
}

export type ResendClient = ReturnType<typeof createResendClient>
