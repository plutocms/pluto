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
