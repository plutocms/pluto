import type { PlutoContentSideGroup, PlutoField } from '../types/content'

export interface PlutoSideFieldGroup {
  group: PlutoContentSideGroup
  fields: PlutoField[]
}

export interface PlutoSideFieldLayout {
  /** The fields with no group (or a group the type does not have). They show first. */
  loose: PlutoField[]
  /** The groups that have fields, by `order`, each with its fields in the order given. */
  groups: PlutoSideFieldGroup[]
}

/**
 * Splits the fields of the side column of the form into its collapsible groups
 * (`PlutoContentType.sideGroups`). The fields keep their order. A group with no field does not
 * show. When two groups have the same id, the first one counts.
 */
export function plutoSideFieldLayout(
  fields: PlutoField[],
  groups: PlutoContentSideGroup[] = []
): PlutoSideFieldLayout {
  const known = new Map<string, PlutoContentSideGroup>()
  for (const group of groups) {
    if (!known.has(group.id)) {
      known.set(group.id, group)
    }
  }

  const loose: PlutoField[] = []
  const byGroup = new Map<string, PlutoField[]>()
  for (const field of fields) {
    if (field.group && known.has(field.group)) {
      const list = byGroup.get(field.group) ?? []
      list.push(field)
      byGroup.set(field.group, list)
    } else {
      loose.push(field)
    }
  }

  return {
    loose,
    groups: [...known.values()]
      .filter((group) => byGroup.has(group.id))
      .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
      .map((group) => ({
        group,
        fields: byGroup.get(group.id) ?? [],
      })),
  }
}
