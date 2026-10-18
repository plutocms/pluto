import { DEFAULT_ERROR_KEY, resolveErrorText } from './internal/error-text'

/**
 * Returns a function that turns an error into text for the admin. It prefers
 * the translation key that a server `createPlutoError` sent (`data.i18n`),
 * then the server `statusMessage` or `message`, then the fallback key. The
 * default fallback is `pluto.errors.unknown`.
 */
export function usePlutoErrorText() {
  const { t, te } = usePlutoI18n()

  return (error: unknown, fallbackKey: string = DEFAULT_ERROR_KEY): string => resolveErrorText(error, fallbackKey, { t, te })
}
