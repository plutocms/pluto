import type { PlutoContentType } from '../../../shared/types/content'
import type { PlutoNavItem } from '../../../shared/types/registry'

/** True when `path` is `base` or a page below it. */
export function isPathWithin(path: string, base: string | undefined): boolean {
  if (!base) {
    return false
  }
  const prefix = base.endsWith('/') ? base : `${base}/`
  return path === base || path.startsWith(prefix)
}

/**
 * The ids of the nav items with children that hold the page at `path`: the
 * item's own `to`, a child's `to`, or one of the item's `match` paths is the
 * page or a page above it.
 */
export function activeNavGroups(items: readonly PlutoNavItem[], path: string): string[] {
  return items
    .filter((item) => (item.children?.length ?? 0) > 0)
    .filter((item) =>
      isPathWithin(path, item.to)
      || item.children!.some((child) => isPathWithin(path, child.to))
      || (item.match ?? []).some((base) => isPathWithin(path, base)))
    .map((item) => item.id)
}

/**
 * The next list of open groups. It keeps the groups that are open now, and
 * adds the group of the active page and each new group with `defaultOpen`.
 * `known` holds the ids of the groups seen before. A group that the user
 * closed stays closed until the next navigation into it.
 */
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

/**
 * The pages of the content types whose `basePath` is the item's `to`: the
 * new page and the edit pages (`editPath('')`, the path before the id). The
 * sidebar opens the item on them. A layer with its own routes, such as
 * `/admin/product/edit/:id` under `/admin/products`, needs no `match`.
 */
export function contentTypeMatches(item: PlutoNavItem, types: readonly PlutoContentType[]): string[] {
  if (!item.to) {
    return []
  }
  return types
    .filter((type) => type.basePath === item.to)
    .flatMap((type) => [type.newPath, type.editPath?.('').replace(/\/+$/, '')])
    .filter((path): path is string => Boolean(path))
}
