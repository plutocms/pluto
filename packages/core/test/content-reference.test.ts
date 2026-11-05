import type { PlutoContentType } from '../shared/types/content'
import { describe, expect, it } from 'vitest'
import {
  isTargetReference,
  referenceFieldIds,
  referenceFieldsTo,
  referenceValue,
} from '../shared/utils/content-reference'

describe('referenceValue', () => {
  it('reads one id, a list, or nothing', () => {
    expect(referenceValue('a')).toEqual(['a'])
    expect(referenceValue(['a', 2, 'b'])).toEqual(['a', 2, 'b'])
    expect(referenceValue(undefined)).toEqual([])
    expect(referenceValue(null)).toEqual([])
    expect(referenceValue('')).toEqual([])
  })

  it('drops values that are not an id', () => {
    expect(referenceValue(['a', '', null, {}, Number.NaN, true, 3])).toEqual([
      'a',
      3,
    ])
  })
})

describe('referenceFieldIds', () => {
  it('gives the ids as text', () => {
    expect(referenceFieldIds([1, 'b'])).toEqual(['1', 'b'])
    expect(referenceFieldIds(7)).toEqual(['7'])
  })
})

describe('isTargetReference and referenceFieldsTo', () => {
  const type: PlutoContentType = {
    name: 'post',
    label: 'Post',
    labelPlural: 'Posts',
    source: 'posts',
    titleField: 'title',
    fields: [
      { name: 'title', type: 'text', label: 'Title' },
      { name: 'tags', type: 'reference', label: 'Tags', target: 'tag' },
      { name: 'cats', type: 'reference', label: 'Cats', target: 'category' },
      { name: 'other', type: 'reference', label: 'Other', optionsUrl: '/x' },
    ],
  }

  it('tells a target reference from other fields', () => {
    expect(isTargetReference(type.fields[0]!)).toBe(false)
    expect(isTargetReference(type.fields[1]!)).toBe(true)
    expect(isTargetReference(type.fields[3]!)).toBe(false)
  })

  it('lists the fields that point to a type', () => {
    expect(referenceFieldsTo(type, 'tag').map((field) => field.name)).toEqual([
      'tags',
    ])
    expect(referenceFieldsTo(type, 'none')).toEqual([])
  })
})
