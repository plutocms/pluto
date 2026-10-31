import type { DropdownMenuItem } from '@nuxt/ui'
import type { PlutoContentType } from '../../../shared/types/content'
import type { PlutoNavGroup } from '../../../shared/types/registry'
import { splitByNavGroup } from './nav-groups'

export interface NewMenuOptions {
  /** The singular label of a type. */
  label: (type: PlutoContentType) => string
  /** The label of a group (already translated). */
  groupLabel: (group: PlutoNavGroup) => string
  /** The link to the new page of a type. */
  to: (type: PlutoContentType) => string
}

/**
 * The items of the "New" menu of the admin bar, for the types that can show a
 * New button. The types without a group come first, as direct links. Each group
 * follows, in the order of `groups`. A group with two or more types is a
 * submenu (label and icon of the group, one link per type). A group with one
 * type shows that type as a direct link. When the only entry is one group, the
 * menu shows the types of the group directly, without the submenu. The caller shows a plain button, not
 * this menu, when there is one type in total.
 */
export function buildNewMenu(
  entries: ReadonlyArray<{ type: PlutoContentType }>,
  groups: readonly PlutoNavGroup[],
  options: NewMenuOptions
): DropdownMenuItem[] {
  const link = ({ type }: { type: PlutoContentType }): DropdownMenuItem => ({
    label: options.label(type),
    icon: type.icon,
    type: 'link',
    to: options.to(type),
  })
  const { ungrouped, grouped } = splitByNavGroup(entries, groups)
  const items: DropdownMenuItem[] = [
    ...ungrouped.map(link),
    ...grouped.flatMap(({ group, items }): DropdownMenuItem[] =>
      items.length >= 2
        ? [
            {
              label: options.groupLabel(group),
              icon: group.icon,
              children: items.map(link),
            },
          ]
        : items.map(link)
    ),
  ]
  const only = items.length === 1 ? items[0] : undefined
  return only?.children ? (only.children as DropdownMenuItem[]) : items
}
