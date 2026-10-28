// Pure engine of the Pluto i18n system. It does not use Nuxt auto-imports, so
// plain Vitest can import it. The Nuxt-aware wrappers are in
// `app/composables/pluto-i18n.ts`. Import from 'vue' explicitly, as
// `registry-factory.ts` does.
import { shallowReactive } from 'vue'

/** A message tree as stored in a locale JSON file. */
export interface MessageTree {
  [key: string]: string | MessageTree
}

/** A message tree flattened to dotted keys. */
export type FlatMessages = Record<string, string>

export type MessageParams = Record<string, unknown>

/**
 * A translation key: a lowercase namespace, then one or more dotted parts.
 * Example: `pluto.common.save`. A plain English label does not match, so
 * `tx()` can tell a key from a literal.
 */
const MESSAGE_KEY = /^[a-z][a-z0-9-]*(?:\.[\w-]+)+$/

export function isMessageKey(value: unknown): value is string {
  return typeof value === 'string' && MESSAGE_KEY.test(value)
}

/** Flattens a nested message tree to dotted keys. Keeps string leaves only. */
export function flattenMessages(tree: MessageTree, prefix = ''): FlatMessages {
  const flat: FlatMessages = {}
  for (const [name, value] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${name}` : name
    if (typeof value === 'string') {
      flat[key] = value
    } else if (value && typeof value === 'object') {
      Object.assign(flat, flattenMessages(value, key))
    }
  }
  return flat
}

/** Replaces each `{name}` with `params.name`. An unknown name stays as it is. */
export function interpolate(message: string, params?: MessageParams): string {
  if (!params) {
    return message
  }
  return message.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name]
    return value === undefined || value === null ? match : String(value)
  })
}

const PLURAL_SEPARATOR = ' | '

/** Returns the number of plural forms in a message. */
export function countPluralForms(message: string): number {
  return message.split(PLURAL_SEPARATOR).length
}

const pluralRules = new Map<string, Intl.PluralRules>()

function getPluralRules(locale: string): Intl.PluralRules {
  let rules = pluralRules.get(locale)
  if (!rules) {
    rules = new Intl.PluralRules(locale)
    pluralRules.set(locale, rules)
  }
  return rules
}

/**
 * Picks one form of a plural message.
 *
 * - One form: returned as it is.
 * - Two forms (`one | other`): `Intl.PluralRules` of the locale decides.
 * - Three forms (`zero | one | other`): 0 gives the first form, even in a
 *   locale where 0 is `one` (pt-BR). Then `Intl.PluralRules` decides.
 */
export function selectPlural(
  message: string,
  count: number,
  locale: string
): string {
  const forms = message.split(PLURAL_SEPARATOR)
  if (forms.length === 1) {
    return message
  }
  const category = getPluralRules(locale).select(count)
  if (forms.length === 2) {
    return category === 'one' ? forms[0]! : forms[1]!
  }
  if (count === 0) {
    return forms[0]!
  }
  return category === 'one' ? forms[1]! : forms[2]!
}

export interface TranslatorOptions {
  /** The active locale code. Called on each translation, so it can be reactive. */
  locale: () => string
  /** The locale to use when a key is missing. Default `en`. */
  fallbackLocale?: string
  /** Returns the flat messages of a locale, or undefined if not loaded. */
  messages: (locale: string) => FlatMessages | undefined
  /** Called once for each missing key. Default: `console.warn` in dev, none otherwise. */
  warn?: (message: string) => void
}

export interface Translator {
  /** Translates a key. A second number argument is the plural count. */
  t: (key: string, params?: MessageParams | number) => string
  /** True if the key exists in the active locale or in the fallback. */
  te: (key: string) => boolean
  /** Translates a key-or-literal value. A literal returns unchanged. */
  tx: (value: string, params?: MessageParams | number) => string
}

/**
 * Builds a translator. Fallback order: the active locale, the fallback
 * locale, then the key itself.
 */
export function createTranslator(options: TranslatorOptions): Translator {
  const fallbackLocale = options.fallbackLocale ?? 'en'
  const warned = new Set<string>()
  const warn =
    options.warn ??
    ((message: string) => {
      if (import.meta.dev) {
        console.warn(message)
      }
    })

  function lookup(key: string):
    | {
        message: string
        locale: string
      }
    | undefined {
    const locale = options.locale()
    const active = options.messages(locale)?.[key]
    if (active !== undefined) {
      return { message: active, locale }
    }
    const fallback = options.messages(fallbackLocale)?.[key]
    if (fallback !== undefined) {
      return { message: fallback, locale: fallbackLocale }
    }
    return undefined
  }

  function t(key: string, params?: MessageParams | number): string {
    const found = lookup(key)
    if (!found) {
      if (!warned.has(key)) {
        warned.add(key)
        warn(`[pluto-i18n] Missing translation key "${key}".`)
      }
      return key
    }
    const values: MessageParams =
      typeof params === 'number' ? { count: params } : (params ?? {})
    let message = found.message
    if (message.includes(PLURAL_SEPARATOR)) {
      const count = Number(values.count)
      message = selectPlural(
        message,
        Number.isNaN(count) ? 1 : count,
        found.locale
      )
    }
    return interpolate(message, values)
  }

  function te(key: string): boolean {
    return lookup(key) !== undefined
  }

  function tx(value: string, params?: MessageParams | number): string {
    return isMessageKey(value) && te(value) ? t(value, params) : value
  }

  return { t, te, tx }
}

/** Deep-merges message trees. A later tree overrides an earlier one. */
export function mergeMessageTrees(...trees: MessageTree[]): MessageTree {
  const result: MessageTree = {}
  for (const tree of trees) {
    for (const [key, value] of Object.entries(tree)) {
      const current = result[key]
      if (typeof value === 'object' && value !== null) {
        result[key] = mergeMessageTrees(
          typeof current === 'object' && current !== null ? current : {},
          value
        )
      } else {
        result[key] = value
      }
    }
  }
  return result
}

export interface LocaleCache<T> {
  /** Reactive read. Returns undefined until the locale is loaded. */
  get: (locale: string) => T | undefined
  /** Loads a locale once. Many calls share one promise. */
  load: (locale: string) => Promise<void>
}

/**
 * A cache of per-locale data (messages, or a Nuxt UI locale object), filled
 * by async loaders. `get` is reactive, so a translation updates when its
 * locale finishes loading.
 */
export function createLocaleCache<T, R = T>(
  loaders: Record<string, () => Promise<R>>,
  transform: (value: R) => T
): LocaleCache<T> {
  const store = shallowReactive(new Map<string, T>())
  const pending = new Map<string, Promise<void>>()

  function load(locale: string): Promise<void> {
    if (store.has(locale)) {
      return Promise.resolve()
    }
    const loader = loaders[locale]
    if (!loader) {
      return Promise.resolve()
    }
    let promise = pending.get(locale)
    if (!promise) {
      promise = loader()
        .then((value) => {
          store.set(locale, transform(value))
        })
        .finally(() => {
          pending.delete(locale)
        })
      pending.set(locale, promise)
    }
    return promise
  }

  return { get: (locale) => store.get(locale), load }
}

const numberFormats = new Map<string, Intl.NumberFormat>()
const dateFormats = new Map<string, Intl.DateTimeFormat>()

/** Formats a number. The `Intl` formatter is cached per locale and options. */
export function formatNumber(
  locale: string,
  value: number,
  options?: Intl.NumberFormatOptions
): string {
  const key = `${locale}|${JSON.stringify(options ?? {})}`
  let format = numberFormats.get(key)
  if (!format) {
    format = new Intl.NumberFormat(locale, options)
    numberFormats.set(key, format)
  }
  return format.format(value)
}

/** Formats a date. The `Intl` formatter is cached per locale and options. */
export function formatDate(
  locale: string,
  value: Date | number | string,
  options?: Intl.DateTimeFormatOptions
): string {
  const key = `${locale}|${JSON.stringify(options ?? {})}`
  let format = dateFormats.get(key)
  if (!format) {
    format = new Intl.DateTimeFormat(locale, options)
    dateFormats.set(key, format)
  }
  return format.format(value instanceof Date ? value : new Date(value))
}

/**
 * Returns the name of a language in its own language, first letter in
 * capitals. Example: `pt-BR` gives "Português (Brasil)".
 */
export function getLanguageName(code: string): string {
  let name = code
  try {
    name = new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code
  } catch {
    // An invalid code keeps the code as the name.
  }
  return name.charAt(0).toLocaleUpperCase(code) + name.slice(1)
}

/**
 * Parses an `Accept-Language` header into language tags, best first. A tag
 * with `q=0` is dropped.
 */
export function parseAcceptLanguage(header: string | undefined): string[] {
  if (!header) {
    return []
  }
  return header
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.trim().split(';')
      const q = params
        .map((param) => /^\s*q=([\d.]+)\s*$/.exec(param)?.[1])
        .find(Boolean)
      return { tag: tag.trim(), q: q === undefined ? 1 : Number(q), index }
    })
    .filter((entry) => entry.tag && entry.tag !== '*' && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index)
    .map((entry) => entry.tag)
}

/**
 * Matches the requested language tags to the supported locale codes. For each
 * tag, in order: an exact match (ignoring case), then the first supported
 * code with the same base language. Returns null if nothing matches.
 */
export function matchLocale(
  requested: string[],
  supported: string[]
): string | null {
  const lower = new Map(supported.map((code) => [code.toLowerCase(), code]))
  for (const tag of requested) {
    const exact = lower.get(tag.toLowerCase())
    if (exact) {
      return exact
    }
    const base = tag.toLowerCase().split('-')[0]!
    const byBase = supported.find(
      (code) => code.toLowerCase().split('-')[0] === base
    )
    if (byBase) {
      return byBase
    }
  }
  return null
}
