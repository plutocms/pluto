/**
 * JSON text of a value with the object keys sorted. Two values with the same
 * data give the same text, whatever the key order. The form compares the text
 * of the payload now with the text at the last save, and the content backup
 * compares field values with it. Pure.
 */
export function stableStringify(value: unknown): string {
  return (
    JSON.stringify(value, (_key, entry) => {
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        return Object.fromEntries(
          Object.entries(entry as Record<string, unknown>).toSorted(
            ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)
          )
        )
      }
      return entry
    }) ?? ''
  )
}
