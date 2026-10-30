import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { computed } from 'vue'
import {
  createTranslator,
  flattenMessages,
  formatDate,
  formatNumber,
} from '../../app/composables/internal/i18n-core'

/**
 * A real translator built from the core locale files. Use it to stub
 * `usePlutoI18n` in a test that runs outside a Nuxt build:
 *
 *   vi.stubGlobal('computed', computed)
 *   vi.stubGlobal('usePlutoI18n', () => createI18nStub())
 *
 * The strings are the real ones, so a test can assert on the English text.
 */
export function createI18nStub(
  initial:
    | string
    | {
        value: string
      } = 'en'
) {
  // A ref as the argument makes the locale reactive, so a test can switch it.
  const locale = () => (typeof initial === 'string' ? initial : initial.value)

  const messages = Object.fromEntries(
    ['en', 'pt-BR'].map((code) => [
      code,
      flattenMessages(
        JSON.parse(
          readFileSync(
            join(__dirname, '..', '..', 'i18n', 'locales', `${code}.json`),
            'utf8'
          )
        )
      ),
    ])
  )
  const { t, te, tx } = createTranslator({
    locale,
    messages: (code) => messages[code],
  })

  return {
    locale: computed(locale),
    locales: computed(() => ['en', 'pt-BR']),
    preference: computed(() => null),
    t,
    tx,
    te,
    n: (value: number, options?: Intl.NumberFormatOptions) =>
      formatNumber(locale(), value, options),
    d: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) =>
      formatDate(locale(), value, options),
    setLocale: async () => {},
    syncUserLocale: async () => {},
  }
}
