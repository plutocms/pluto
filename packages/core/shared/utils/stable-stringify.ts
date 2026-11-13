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
