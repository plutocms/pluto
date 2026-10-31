// Reads a `.navigation.yml` file of a folder. No Nuxt import, so plain Vitest tests it.
// Nuxt Content applies these files to the navigation tree. See `folderItemFields` in
// `runtime-content.ts` for the keys that count.

import { parse } from 'yaml'

/** The parsed file, or `undefined` when the text is empty, is not valid YAML, or is not a map. */
export function parseNavigationConfig(
  source: string
): Record<string, unknown> | undefined {
  try {
    const data: unknown = parse(source)
    return typeof data === 'object' && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}
