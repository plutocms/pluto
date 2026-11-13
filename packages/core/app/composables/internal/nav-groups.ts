import type { PlutoContentType } from '../../../shared/types/content'
import type { PlutoNavGroup } from '../../../shared/types/registry'

export function findNavGroup(
  groups: readonly PlutoNavGroup[],
  name: string | undefined
): PlutoNavGroup | undefined {
  if (!name) {
    return undefined
  }
  const exact = groups.find((group) => group.id === name)
  if (exact) {
    return exact
  }
  const bare = groups.filter((group) => group.id.endsWith(`:${name}`))
  return bare.length === 1 ? bare[0] : undefined
}

export interface NavGroupBucket<T> {
  group: PlutoNavGroup
  items: T[]
}

export function splitByNavGroup<T extends { type: PlutoContentType }>(
  entries: readonly T[],
  groups: readonly PlutoNavGroup[]
): { ungrouped: T[]; grouped: NavGroupBucket<T>[] } {
  const ungrouped: T[] = []
  const buckets = new Map<string, NavGroupBucket<T>>()
  for (const entry of entries) {
    const group = findNavGroup(groups, entry.type.navGroup)
    if (!group) {
      ungrouped.push(entry)
      continue
    }
    const bucket = buckets.get(group.id) ?? { group, items: [] }
    bucket.items.push(entry)
    buckets.set(group.id, bucket)
  }
  return {
    ungrouped,
    grouped: groups.flatMap((group) => buckets.get(group.id) ?? []),
  }
}
