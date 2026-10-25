import type { PlutoMailErrorCode } from '../../shared/types/mail'

/**
 * A mail failure. `code` says why, and the admin shows a translated hint for
 * it. `message` is English and safe to log: it never holds a recipient, a
 * subject, a link or a key.
 */
export class PlutoMailError extends Error {
  readonly code: PlutoMailErrorCode
  /** The HTTP status of the provider answer, when there was one. */
  readonly status?: number
  /** The provider's own error name (a short token such as `validation_error`), when there was one. */
  readonly providerCode?: string

  constructor(code: PlutoMailErrorCode, message: string, options: {
 status?: number
providerCode?: string
} = {}) {
    super(message)
    this.name = 'PlutoMailError'
    this.code = code
    this.status = options.status
    this.providerCode = options.providerCode
  }
}

export function isPlutoMailError(error: unknown): error is PlutoMailError {
  return error instanceof PlutoMailError
}
