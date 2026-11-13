export type PlutoGithubStoreErrorCode =
  'conflict' | 'auth' | 'forbidden' | 'rate-limit' | 'not-found' | 'github'

export class PlutoGithubStoreError extends Error {
  readonly code: PlutoGithubStoreErrorCode
  readonly status?: number
  readonly retryAfter?: number

  constructor(
    code: PlutoGithubStoreErrorCode,
    message: string,
    extra: {
      status?: number
      retryAfter?: number
    } = {}
  ) {
    super(message)
    this.name = 'PlutoGithubStoreError'
    this.code = code
    this.status = extra.status
    this.retryAfter = extra.retryAfter
  }
}

export class PlutoGithubConflictError extends PlutoGithubStoreError {
  constructor(message = 'The content changed since you loaded it.') {
    super('conflict', message, { status: 409 })
    this.name = 'PlutoGithubConflictError'
  }
}

export function isPlutoGithubConflictError(
  error: unknown
): error is PlutoGithubConflictError {
  return error instanceof PlutoGithubConflictError
}
