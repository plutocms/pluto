import type { H3Error } from 'h3'
import { createError } from 'h3'

export interface PlutoErrorOptions {
  statusCode: number
  /** English text. It becomes the `statusMessage`, so the server always speaks English. */
  message: string
  /** Translation key of the same message, for the admin UI. Example: `pluto.errors.notFound`. */
  key: string
  /** Values for the translated message. */
  params?: Record<string, unknown>
  /** Extra response data, for example `{ errors }`. It sits next to `i18n`. */
  data?: Record<string, unknown>
}

/**
 * Creates an H3 error that the admin can show in its own language. The
 * `statusMessage` stays English. The translation key and its values go in
 * `data.i18n`, and the client reads them with `usePlutoErrorText()`.
 */
export function createPlutoError(options: PlutoErrorOptions): H3Error {
  return createError({
    statusCode: options.statusCode,
    statusMessage: options.message,
    data: {
      ...options.data,
      i18n: { key: options.key, params: options.params },
    },
  })
}
