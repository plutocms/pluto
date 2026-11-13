import type { Locale, Messages } from '@nuxt/ui'
import type { FlatMessages, MessageTree } from './i18n-core'
import { markRaw } from 'vue'
import {
  defaultLocale,
  messageLoaders,
  uiLocaleLoaders,
} from '#build/pluto-i18n.mjs'
import { useCookie, useRequestHeaders, useRuntimeConfig } from '#imports'
import {
  createLocaleCache,
  flattenMessages,
  matchLocale,
  parseAcceptLanguage,
} from './i18n-core'

export const ADMIN_LOCALE_COOKIE = 'pluto-admin-locale'
export const SITE_LOCALE_COOKIE = 'pluto-site-locale'

const COOKIE_OPTIONS = {
  maxAge: 60 * 60 * 24 * 365,
  path: '/',
  sameSite: 'lax',
} as const

export const messageCache = createLocaleCache<FlatMessages, MessageTree>(
  messageLoaders as Record<string, () => Promise<MessageTree>>,
  flattenMessages
)

export const uiLocaleCache = createLocaleCache<Locale<Messages>>(
  uiLocaleLoaders as Record<string, () => Promise<Locale<Messages>>>,
  (locale) => markRaw(locale)
)

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
  return useCookie<string | null>(name, {
    ...COOKIE_OPTIONS,
    default: () => null,
  })
}

function getBrowserLanguages(): string[] {
  if (import.meta.server) {
    return parseAcceptLanguage(
      useRequestHeaders(['accept-language'])['accept-language']
    )
  }
  return typeof navigator === 'undefined' ? [] : [...navigator.languages]
}

export function detectAdminLocale(): string {
  const config = getConfig()
  return (
    matchLocale(getBrowserLanguages(), config.adminLocales) ??
    config.defaultLocale
  )
}

export function readAdminPreference(): string | null {
  const value = useLocaleCookie(ADMIN_LOCALE_COOKIE).value
  return value && getConfig().adminLocales.includes(value) ? value : null
}

function resolveAdminLocale(): string {
  return readAdminPreference() ?? detectAdminLocale()
}

function resolveSiteLocale(): string {
  const config = getConfig()
  const cookie = useLocaleCookie(SITE_LOCALE_COOKIE).value
  if (cookie && config.siteLocales.includes(cookie)) {
    return cookie
  }
  return config.siteLocale || config.defaultLocale || defaultLocale
}

export function resolveScopeLocale(scope: 'admin' | 'site'): string {
  return scope === 'admin' ? resolveAdminLocale() : resolveSiteLocale()
}
