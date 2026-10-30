import type { PlutoContentItem, PlutoField } from '../types/content'

/**
 * Returns the text that the generic list shows for one field of one item.
 *
 * A field with `listFormat` shows what the formatter returns. A formatter
 * that throws does not break the list: the raw value shows instead. A field
 * with no formatter shows the raw value as text. An empty value is an empty
 * string.
 *
 * This function is pure and has no browser or Nuxt dependency, so it is safe
 * to call on the server too.
 */
export function formatListValue(
  field: PlutoField,
  item: PlutoContentItem
): string {
  const value = item[field.name]

  if (field.listFormat) {
    try {
      return String(field.listFormat(value, item) ?? '')
    } catch {
      return rawListValue(value)
    }
  }

  return rawListValue(value)
}

function rawListValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}
