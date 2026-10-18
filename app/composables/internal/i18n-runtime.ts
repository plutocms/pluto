// The Nuxt-aware part of the i18n engine: the shared caches, the language
// detection, and the first-locale resolve. It sits under `internal/` so it
// stays out of auto-import. The pure part is in `i18n-core.ts`.
import type { Locale, Messages } from '@nuxt/ui'
import type { FlatMessages, MessageTree } from './i18n-core'
import { markRaw } from 'vue'
import { defaultLocale, messageLoaders, uiLocaleLoaders } from '#build/pluto-i18n.mjs'
import { useCookie, useRequestHeaders, useRuntimeConfig } from '#imports'
import { createLocaleCache, flattenMessages, matchLocale, parseAcceptLanguage } from './i18n-core'

/** Cookie names. The admin and the site keep a separate locale. */
export const ADMIN_LOCALE_COOKIE = 'pluto-admin-locale'
export const SITE_LOCALE_COOKIE = 'pluto-site-locale'

const COOKIE_OPTIONS = { maxAge: 60 * 60 * 24 * 365, path: '/', sameSite: 'lax' } as const

/**
 * One message cache for both scopes. Messages never change per request, so
 * a module-level cache is safe on the server too.
 */
export const messageCache = createLocaleCache<FlatMessages, MessageTree>(
  messageLoaders as Record<string, () => Promise<MessageTree>>,
  flattenMessages
)

/** The Nuxt UI locale objects, for `UApp :locale`. */
export const uiLocaleCache = createLocaleCache<Locale<Messages>>(
  uiLocaleLoaders as Record<string, () => Promise<Locale<Messages>>>,
  (locale) => markRaw(locale)
)

/** Loads the messages and the Nuxt UI locale of a locale, and of `en` for the fallback. */
export async function loadPlutoLocale(code: string): Promise<void> {
  await Promise.all([
    messageCache.load(code),
    messageCache.load('en'),
    uiLocaleCache.load(code),
    uiLocaleCache.load('en'),
  ])
}

export function getConfig() {
  return useRuntimeConfig().public.plutoI18n
}

export function useLocaleCookie(name: string) {
  return useCookie<string | null>(name, { ...COOKIE_OPTIONS, default: () => null })
}

/**
 * The visitor's language tags, best first. On the server, from the
 * `Accept-Language` header. On the client, from `navigator.languages`. The
 * server never reads `navigator`.
 */
export function getBrowserLanguages(): string[] {
  if (import.meta.server) {
    return parseAcceptLanguage(useRequestHeaders(['accept-language'])['accept-language'])
  }
  return typeof navigator === 'undefined' ? [] : [...navigator.languages]
}

/** The admin locale from the browser language alone: no cookie, no stored choice. */
export function detectAdminLocale(): string {
  const config = getConfig()
  return matchLocale(getBrowserLanguages(), config.adminLocales) ?? config.defaultLocale
}

/** A stored admin choice, or null. Only a supported code counts. */
export function readAdminPreference(): string | null {
  const value = useLocaleCookie(ADMIN_LOCALE_COOKIE).value
  return value && getConfig().adminLocales.includes(value) ? value : null
}

/** Admin order: cookie, browser language, default locale. */
export function resolveAdminLocale(): string {
  return readAdminPreference() ?? detectAdminLocale()
}

/** Site order: cookie, the `siteLocale` option, default locale. */
export function resolveSiteLocale(): string {
  const config = getConfig()
  const cookie = useLocaleCookie(SITE_LOCALE_COOKIE).value
  if (cookie && config.siteLocales.includes(cookie)) {
    return cookie
  }
  return config.siteLocale || config.defaultLocale || defaultLocale
}
