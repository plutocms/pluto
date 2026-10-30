import type { PlutoContentType } from '../shared/types/content'
import type { PlutoNavGroup } from '../shared/types/registry'
import { describe, expect, it } from 'vitest'
import {
  findNavGroup,
  splitByNavGroup,
} from '../app/composables/internal/nav-groups'

const groups: PlutoNavGroup[] = [
  { id: 'pluto:pages', label: 'Pages' },
  { id: 'shop:catalog', label: 'Catalog' },
  { id: 'a:extra', label: 'Extra A' },
  { id: 'b:extra', label: 'Extra B' },
]

function entry(name: string, navGroup?: string) {
  return { type: { name, navGroup } as PlutoContentType }
}

describe('findNavGroup', () => {
  it('matches the full id', () => {
    expect(findNavGroup(groups, 'shop:catalog')?.label).toBe('Catalog')
  })

  it('matches a bare id when one group has it', () => {
    expect(findNavGroup(groups, 'pages')?.id).toBe('pluto:pages')
  })

  it('gives nothing for an unknown, an ambiguous or an empty name', () => {
    expect(findNavGroup(groups, 'nope')).toBeUndefined()
    expect(findNavGroup(groups, 'extra')).toBeUndefined()
    expect(findNavGroup(groups, undefined)).toBeUndefined()
  })
})

describe('splitByNavGroup', () => {
  it('splits the types and keeps the order of the groups', () => {
    const result = splitByNavGroup(
      [
        entry('a', 'shop:catalog'),
        entry('b'),
        entry('c', 'pages'),
        entry('d', 'nope'),
        entry('e', 'pages'),
      ],
      groups
    )

    expect(result.ungrouped.map((e) => e.type.name)).toEqual(['b', 'd'])
    expect(
      result.grouped.map((bucket) => [
        bucket.group.id,
        bucket.items.map((e) => e.type.name),
      ])
    ).toEqual([
      ['pluto:pages', ['c', 'e']],
      ['shop:catalog', ['a']],
    ])
  })
})
