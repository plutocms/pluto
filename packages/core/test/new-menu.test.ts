import type { PlutoContentType } from '../shared/types/content'
import type { PlutoNavGroup } from '../shared/types/registry'
import { describe, expect, it } from 'vitest'
import { buildNewMenu } from '../app/composables/internal/new-menu'

const groups: PlutoNavGroup[] = [
  { id: 'pluto:pages', label: 'Pages', icon: 'i-pages' },
  { id: 'shop:catalog', label: 'Catalog', icon: 'i-catalog' },
]

function entry(name: string, navGroup?: string) {
  return { type: { name, navGroup, icon: `i-${name}` } as PlutoContentType }
}

const options = {
  label: (type: PlutoContentType) => type.name.toUpperCase(),
  groupLabel: (group: PlutoNavGroup) => group.label,
  to: (type: PlutoContentType) => `/new/${type.name}`,
}

describe('buildNewMenu', () => {
  it('lists ungrouped types as direct links', () => {
    expect(buildNewMenu([entry('a'), entry('b')], groups, options)).toEqual([
      { label: 'A', icon: 'i-a', type: 'link', to: '/new/a' },
      { label: 'B', icon: 'i-b', type: 'link', to: '/new/b' },
    ])
  })

  it('makes a submenu of a group with two or more types', () => {
    const items = buildNewMenu(
      [entry('a', 'pages'), entry('b', 'pages')],
      groups,
      options
    )
    expect(items).toEqual([
      {
        label: 'Pages',
        icon: 'i-pages',
        children: [
          { label: 'A', icon: 'i-a', type: 'link', to: '/new/a' },
          { label: 'B', icon: 'i-b', type: 'link', to: '/new/b' },
        ],
      },
    ])
  })

  it('shows the type of a group with one type as a direct link', () => {
    const items = buildNewMenu(
      [entry('a', 'pages'), entry('c')],
      groups,
      options
    )
    expect(items.map((item) => item.label)).toEqual(['C', 'A'])
    expect(items.every((item) => !('children' in item))).toBe(true)
  })

  it('puts ungrouped types first, then the groups by group order', () => {
    const items = buildNewMenu(
      [
        entry('s1', 'shop:catalog'),
        entry('s2', 'shop:catalog'),
        entry('p1', 'pages'),
        entry('p2', 'pages'),
        entry('x'),
        entry('y', 'nope'),
      ],
      groups,
      options
    )
    expect(items.map((item) => item.label)).toEqual([
      'X',
      'Y',
      'Pages',
      'Catalog',
    ])
  })
})
