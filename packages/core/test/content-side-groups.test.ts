import type { PlutoField } from '../shared/types/content'
import { describe, expect, it } from 'vitest'
import { plutoSideFieldLayout } from '../shared/utils/content-side-groups'

function field(name: string, group?: string): PlutoField {
  return {
    name,
    type: 'text',
    label: name,
    region: 'side',
    ...(group && { group }),
  }
}

const names = (fields: PlutoField[]) => fields.map((f) => f.name)

describe('plutoSideFieldLayout', () => {
  it('keeps every field loose when the type has no group', () => {
    const layout = plutoSideFieldLayout([field('a'), field('b', 'seo')])
    expect(names(layout.loose)).toEqual(['a', 'b'])
    expect(layout.groups).toEqual([])
  })

  it('puts fields in their groups, in field order, groups by order', () => {
    const layout = plutoSideFieldLayout(
      [field('a'), field('t1', 'seo'), field('x', 'extra'), field('t2', 'seo')],
      [
        { id: 'seo', label: 'SEO', order: 900 },
        { id: 'extra', label: 'Extra', order: 50 },
      ]
    )
    expect(names(layout.loose)).toEqual(['a'])
    expect(layout.groups.map((g) => g.group.id)).toEqual(['extra', 'seo'])
    expect(names(layout.groups[1]!.fields)).toEqual(['t1', 't2'])
  })

  it('leaves out a group with no field, and keeps the first of two ids', () => {
    const layout = plutoSideFieldLayout(
      [field('t', 'seo')],
      [
        { id: 'empty', label: 'Empty' },
        { id: 'seo', label: 'First' },
        { id: 'seo', label: 'Second' },
      ]
    )
    expect(layout.groups.map((g) => g.group.label)).toEqual(['First'])
  })

  it('sorts a group with no order at 100', () => {
    const layout = plutoSideFieldLayout(
      [field('a', 'late'), field('b', 'plain')],
      [
        { id: 'late', label: 'Late', order: 101 },
        { id: 'plain', label: 'Plain' },
      ]
    )
    expect(layout.groups.map((g) => g.group.id)).toEqual(['plain', 'late'])
  })
})
