import { parse } from 'yaml'

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
