declare global {
  /**
   * The translation keys of the app, with the placeholder names of each message. Pluto generates
   * it from the `i18n/locales/en.json` files of the app and its layers.
   *
   * @see https://pluto.vulmix.dev/docs/build/i18n
   */
  interface PlutoMessages {}
}

/**
 * A translation key of the app or one of its layers, for example `pluto.nav.home`. Any string
 * before Pluto generates the keys.
 *
 * @see https://pluto.vulmix.dev/docs/build/i18n
 */
export type PlutoMessageKey = [keyof PlutoMessages] extends [never]
  ? string
  : keyof PlutoMessages & string

/** A value for a placeholder of a message. */
export type PlutoMessageValue = string | number

/**
 * The params of `t(key, ...)` for `key`. A message with placeholders needs a value for each one.
 * A plural message, or a message with only `{count}`, also takes a number.
 */
export type PlutoMessageArgs<K extends string> = K extends keyof PlutoMessages
  ? [PlutoMessages[K]] extends [never]
    ? [params?: Record<string, unknown> | number]
    : [PlutoMessages[K]] extends ['count']
      ? [
          params:
            number | ({ count: PlutoMessageValue } & Record<string, unknown>),
        ]
      : [
          params: {
            [P in PlutoMessages[K] & string]: PlutoMessageValue
          } & Record<string, unknown>,
        ]
  : [params?: Record<string, unknown> | number]

/**
 * The `t` function of `usePlutoI18n`, `usePlutoSiteI18n` and `usePlutoServerTranslator`. It takes a
 * known key, and the params that the message needs.
 *
 * @see https://pluto.vulmix.dev/docs/build/i18n
 */
export type PlutoTranslateFn = <K extends PlutoMessageKey>(
  key: K,
  ...params: PlutoMessageArgs<K>
) => string

/**
 * A translation key or plain text, for a label that `tx` shows: a key is translated, other text
 * shows as it is. The editor suggests the keys.
 *
 * @see https://pluto.vulmix.dev/docs/build/i18n
 */
export type PlutoText = PlutoMessageKey | (string & {})

/**
 * The options of the `pluto-i18n` module, as the module resolves them and
 * exposes them in `runtimeConfig.public.plutoI18n`.
 */
export interface PlutoI18nRuntimeConfig {
  /** The fallback locale. */
  defaultLocale: string
  /** Locales the admin offers. */
  adminLocales: string[]
  /** Locales the public site can use. */
  siteLocales: string[]
  /** The public site's locale before a visitor picks one. */
  siteLocale: string
  /**
   * True when the app sets `siteLocale` or `siteLocales`. Only then does
   * Pluto set `<html lang>` on public routes. Otherwise the app keeps its own.
   */
  siteManaged: boolean
}
