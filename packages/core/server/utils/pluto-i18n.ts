import type {
  FlatMessages,
  MessageTree,
  Translator,
} from '../../app/composables/internal/i18n-core'
import {
  createTranslator,
  flattenMessages,
  matchLocale,
} from '../../app/composables/internal/i18n-core'

/** The locale data of the Nitro virtual module `#pluto-i18n-server`. */
export interface PlutoServerMessageSource {
  localeCodes: string[]
  defaultLocale: string
  messageLoaders: Record<string, () => Promise<Record<string, unknown>>>
}

/** A translator for one locale on the server. `locale` is the code it resolved to. */
export interface PlutoServerTranslator extends Translator {
  locale: string
}

function warnInDev(message: string): void {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(message)
  }
}

/**
 * Builds the server translator function over a message source. The server
 * has no reactive state and no request context, so a translator is cheap:
 * it wraps the same engine as the admin (`createTranslator`), over messages
 * that load once per locale and stay in memory.
 *
 * The locale resolves like this: an exact or base-language match in
 * `localeCodes`, else the default locale. A key that is missing in the
 * locale falls back to the default locale, then to the key itself.
 */
export function createPlutoServerTranslatorFactory(
  source: PlutoServerMessageSource
) {
  const cache = new Map<string, FlatMessages>()
  const pending = new Map<string, Promise<void>>()

  function load(code: string): Promise<void> {
    if (cache.has(code)) {
      return Promise.resolve()
    }
    const loader = source.messageLoaders[code]
    if (!loader) {
      return Promise.resolve()
    }
    let promise = pending.get(code)
    if (!promise) {
      promise = loader()
        .then((tree) => {
          cache.set(code, flattenMessages(tree as MessageTree))
        })
        .finally(() => {
          pending.delete(code)
        })
      pending.set(code, promise)
    }
    return promise
  }

  return async function getTranslator(
    locale?: string | null
  ): Promise<PlutoServerTranslator> {
    const resolved =
      (locale ? matchLocale([locale], source.localeCodes) : null) ??
      source.defaultLocale
    await Promise.all([load(resolved), load(source.defaultLocale)])

    const translator = createTranslator({
      locale: () => resolved,
      fallbackLocale: source.defaultLocale,
      messages: (code) => cache.get(code),
      warn: warnInDev,
    })

    return { ...translator, locale: resolved }
  }
}

let factory: ReturnType<typeof createPlutoServerTranslatorFactory> | undefined

/**
 * Returns a translator for `locale` (a code such as `pt-BR`, or a language
 * tag). Use it in a server route or a server util, for example to render an
 * email. It reads the same `i18n/locales/<code>.json` files as the admin,
 * merged across layers, base layer first and the app last. An unknown or
 * missing locale uses the default locale.
 */
export async function usePlutoServerTranslator(
  locale?: string | null
): Promise<PlutoServerTranslator> {
  if (!factory) {
    const source = await import('#pluto-i18n-server')
    factory = createPlutoServerTranslatorFactory(source)
  }
  return factory(locale)
}
