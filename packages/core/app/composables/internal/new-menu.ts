import type { DropdownMenuItem } from '@nuxt/ui'
import type { PlutoContentType } from '../../../shared/types/content'
import type { PlutoNavGroup } from '../../../shared/types/registry'
import { splitByNavGroup } from './nav-groups'

export interface NewMenuOptions {
  label: (type: PlutoContentType) => string
  groupLabel: (group: PlutoNavGroup) => string
  to: (type: PlutoContentType) => string
}

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
