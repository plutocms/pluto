import type { PlutoContentType } from '../../../shared/types/content'
import type { PlutoNavItem } from '../../../shared/types/registry'

export function isPathWithin(path: string, base: string | undefined): boolean {
  if (!base) {
    return false
  }
  const prefix = base.endsWith('/') ? base : `${base}/`
  return path === base || path.startsWith(prefix)
}

export function activeNavGroups(
  items: readonly PlutoNavItem[],
  path: string
): string[] {
  return items
    .filter((item) => (item.children?.length ?? 0) > 0)
    .filter(
      (item) =>
        isPathWithin(path, item.to) ||
        item.children!.some((child) => isPathWithin(path, child.to)) ||
        (item.match ?? []).some((base) => isPathWithin(path, base))
    )
    .map((item) => item.id)
}

export function nextOpenGroups(
  open: readonly string[],
  items: readonly PlutoNavItem[],
  path: string,
  known: ReadonlySet<string>,
  navigated: boolean
): string[] {
  const next = new Set(open)
  for (const item of items) {
    if (item.defaultOpen && !known.has(item.id)) {
      next.add(item.id)
    }
  }
  for (const id of activeNavGroups(items, path)) {
    if (navigated || !known.has(id)) {
      next.add(id)
    }
  }
  return [...next]
}

export function contentTypeMatches(
  item: PlutoNavItem,
  types: readonly PlutoContentType[]
): string[] {
  if (!item.to) {
    return []
  }
  return types
    .filter((type) => type.basePath === item.to)
    .flatMap((type) => [type.newPath, type.editPath?.('').replace(/\/+$/, '')])
    .filter((path): path is string => Boolean(path))
}
