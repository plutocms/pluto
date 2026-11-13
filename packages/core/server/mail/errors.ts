import type { PlutoMailErrorCode } from '../../shared/types/mail'

export class PlutoMailError extends Error {
  readonly code: PlutoMailErrorCode
  readonly status?: number
  readonly providerCode?: string

  constructor(
    code: PlutoMailErrorCode,
    message: string,
    options: {
      status?: number
      providerCode?: string
    } = {}
  ) {
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
