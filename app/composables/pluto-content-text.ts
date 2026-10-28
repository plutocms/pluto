import { createContentText } from './internal/content-text'

/**
 * The translated text of one content type. Each value is the convention key
 * (`content.<name>.label`, `.labelPlural`, `.new`, `.fields.<field>.label`
 * and more) when the key exists, else the English literal of the type. A type
 * with no keys keeps its English text.
 *
 * Read the values inside a template or a `computed`, so a locale switch
 * updates them. Server code and code that reads `type.label` directly keep
 * the English text.
 */
export function usePlutoContentText(
  type: MaybeRefOrGetter<PlutoContentType | undefined>
) {
  const { t, te, locale } = usePlutoI18n()
  return createContentText(() => toValue(type), { t, te, locale })
}

/**
 * Returns a function that gives the translated text of a content type by its
 * `name`. Use it where one component shows many types, such as the dashboard
 * tiles. See `usePlutoContentText`.
 */
export function usePlutoContentTexts() {
  const { t, te, locale } = usePlutoI18n()
  const { byName } = usePlutoContentTypes()

  return (name: string) =>
    createContentText(() => byName(name), { t, te, locale })
}
