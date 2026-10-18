import type { MessageParams } from './internal/i18n-core'
import {
  createTranslator,
  formatDate,
  formatNumber,
} from './internal/i18n-core'
import {
  ADMIN_LOCALE_COOKIE,
  detectAdminLocale,
  getConfig,
  loadPlutoLocale,
  messageCache,
  readAdminPreference,
  SITE_LOCALE_COOKIE,
  uiLocaleCache,
  useLocaleCookie,
} from './internal/i18n-runtime'

/** Missing keys already reported. Shared, so a key warns once per process. */
const warnedKeys = new Set<string>()

function warnOnce(message: string) {
  if (import.meta.dev && !warnedKeys.has(message)) {
    warnedKeys.add(message)
    console.warn(message)
  }
}

/**
 * The state both scopes share: the active locale, the translator, the
 * formatters, and the Nuxt UI locale object. The admin and the site keep a
 * separate active locale and a shared message cache.
 */
function useLocaleScope(scope: 'admin' | 'site') {
  const config = getConfig()
  const state = useState<string>(`pluto-${scope}-locale`, () => config.defaultLocale)
  const locales = scope === 'admin' ? config.adminLocales : config.siteLocales

  const { t, te, tx } = createTranslator({
    locale: () => state.value,
    fallbackLocale: 'en',
    messages: (code) => messageCache.get(code),
    warn: warnOnce,
  })

  return {
    state,
    locales,
    locale: computed(() => state.value),
    uiLocale: computed(() => uiLocaleCache.get(state.value) ?? uiLocaleCache.get('en')),
    t: (key: string, params?: MessageParams | number) => t(key, params),
    tx: (value: string, params?: MessageParams | number) => tx(value, params),
    te,
    n: (value: number, options?: Intl.NumberFormatOptions) => formatNumber(state.value, value, options),
    d: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => formatDate(state.value, value, options),
  }
}

/**
 * Translation for the admin. The admin locale is per user: a stored choice
 * (cookie, and the registered locale driver), else the browser language, else
 * the default locale.
 *
 * `tx(value)` translates a key-or-literal string. It translates only when the
 * value looks like a key and the key exists. Any other value returns as it is.
 */
export function usePlutoI18n() {
  const scope = useLocaleScope('admin')
  const registry = usePlutoRegistry()
  const cookie = useLocaleCookie(ADMIN_LOCALE_COOKIE)
  const driver = computed(() => registry.localeDrivers.list.value.at(-1) ?? null)

  /** The stored choice. Null means Automatic. */
  const preference = useState<string | null>('pluto-admin-locale-preference', () => readAdminPreference())

  async function switchTo(code: string) {
    await loadPlutoLocale(code)
    scope.state.value = code
  }

  /**
   * Switches the admin language at once. A code is an explicit choice. Null is
   * Automatic: the browser language is detected again. The cookie keeps the
   * explicit code, or is cleared for Automatic. Then the registered locale
   * driver, if any, saves the choice. A driver error rejects the promise, and
   * the switch stays.
   */
  async function setLocale(code: string | null) {
    if (code !== null && !scope.locales.includes(code)) {
      return
    }
    await switchTo(code ?? detectAdminLocale())
    preference.value = code
    cookie.value = code
    await driver.value?.save(code)
  }

  /**
   * Reads the user's stored language from the locale driver. A stored code
   * switches the admin to it and sets the cookie. No stored code means
   * Automatic: the cookie is cleared, and the browser language applies. With
   * no driver, or on a driver error, nothing changes.
   */
  async function syncUserLocale() {
    if (!driver.value) {
      return
    }
    let stored: string | null
    try {
      stored = await driver.value.load()
    } catch (error) {
      warnOnce(`[pluto-i18n] Could not load the user's language: ${error instanceof Error ? error.message : String(error)}`)
      return
    }
    if (stored && scope.locales.includes(stored)) {
      await switchTo(stored)
      preference.value = stored
      cookie.value = stored
    } else {
      await switchTo(detectAdminLocale())
      preference.value = null
      cookie.value = null
    }
  }

  return {
    locale: scope.locale,
    locales: computed(() => scope.locales),
    uiLocale: scope.uiLocale,
    preference: computed(() => preference.value),
    t: scope.t,
    tx: scope.tx,
    te: scope.te,
    n: scope.n,
    d: scope.d,
    setLocale,
    syncUserLocale,
  }
}

/**
 * Translation for the public site. The site locale belongs to the app: the
 * `pluto-site-locale` cookie, else the `plutoI18n.siteLocale` option, else the
 * default locale. It does not follow the admin language.
 */
export function usePlutoSiteI18n() {
  const scope = useLocaleScope('site')
  const cookie = useLocaleCookie(SITE_LOCALE_COOKIE)

  /** Switches the site language, and keeps it in the `pluto-site-locale` cookie. */
  async function setLocale(code: string) {
    if (!scope.locales.includes(code)) {
      return
    }
    await loadPlutoLocale(code)
    scope.state.value = code
    cookie.value = code
  }

  return {
    locale: scope.locale,
    locales: computed(() => scope.locales),
    uiLocale: scope.uiLocale,
    t: scope.t,
    tx: scope.tx,
    te: scope.te,
    n: scope.n,
    d: scope.d,
    setLocale,
  }
}
