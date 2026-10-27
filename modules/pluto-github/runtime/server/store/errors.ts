export type PlutoGithubStoreErrorCode
  = | 'conflict'
    | 'auth'
    | 'forbidden'
    | 'rate-limit'
    | 'not-found'
    | 'github'

/**
 * A typed error of the storage layer. It is framework-free. The content
 * adapter maps `code` to an HTTP status.
 */
export class PlutoGithubStoreError extends Error {
  readonly code: PlutoGithubStoreErrorCode
  /** The HTTP status GitHub returned, when there is one. */
  readonly status?: number
  /** Seconds to wait before a retry, for a rate-limit error. */
  readonly retryAfter?: number

  constructor(code: PlutoGithubStoreErrorCode, message: string, extra: {
 status?: number
retryAfter?: number
} = {}) {
    super(message)
    this.name = 'PlutoGithubStoreError'
    this.code = code
    this.status = extra.status
    this.retryAfter = extra.retryAfter
  }
}

/** The expected head is stale: someone else committed first. Map it to 409. */
export class PlutoGithubConflictError extends PlutoGithubStoreError {
  constructor(message = 'The content changed since you loaded it.') {
    super('conflict', message, { status: 409 })
    this.name = 'PlutoGithubConflictError'
  }
}

export function isPlutoGithubConflictError(error: unknown): error is PlutoGithubConflictError {
  return error instanceof PlutoGithubConflictError
}
