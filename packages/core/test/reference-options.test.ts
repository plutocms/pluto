import type { PlutoContentType } from '../shared/types/content'
import { describe, expect, it } from 'vitest'
import {
  findReferenceOption,
  isReferenceCacheFresh,
  referenceCreateBody,
  referenceOptionsFromItems,
  referenceSlugField,
  withUnknownIds,
} from '../app/composables/internal/reference-options'
import { slugifyTitle } from '../shared/utils/content-slug'

const tagType: PlutoContentType = {
  name: 'tag',
  label: 'Tag',
  labelPlural: 'Tags',
  source: 'tags',
  titleField: 'title',
  fields: [
    { name: 'title', type: 'text', label: 'Name' },
    { name: 'slug', type: 'slug', label: 'Slug', from: 'title' },
  ],
}

describe('referenceOptionsFromItems', () => {
  it('uses the title as the label and the id as the value', () => {
    expect(
      referenceOptionsFromItems(tagType, [
        { id: 'hiking', title: 'Hiking', slug: 'hiking' },
        { id: 7, title: ' Food ' },
      ])
    ).toEqual([
      { label: 'Hiking', value: 'hiking', slug: 'hiking' },
      { label: 'Food', value: 7 },
    ])
  })

  it('shows the id for an item with no title', () => {
    expect(
      referenceOptionsFromItems(tagType, [{ id: 'a', title: '' }])
    ).toEqual([{ label: 'a', value: 'a' }])
  })
})

describe('findReferenceOption', () => {
  const options = [
    { label: 'Hiking', value: 'hiking', slug: 'hiking' },
    { label: 'Pão de Mel', value: 'pao-de-mel', slug: 'pao-de-mel' },
  ]

  it('matches the label without case or edge spaces', () => {
    expect(findReferenceOption(options, '  hiking ', slugifyTitle)?.value).toBe(
      'hiking'
    )
  })

  it('matches the slug of the text', () => {
    expect(
      findReferenceOption(options, 'Pao de mel', slugifyTitle)?.value
    ).toBe('pao-de-mel')
  })

  it('finds nothing for empty text or a new term', () => {
    expect(findReferenceOption(options, '  ', slugifyTitle)).toBeUndefined()
    expect(findReferenceOption(options, 'Winter', slugifyTitle)).toBeUndefined()
  })
})

describe('referenceCreateBody', () => {
  it('sends the title and its slug', () => {
    expect(referenceCreateBody(tagType, ' Pão de Mel ', slugifyTitle)).toEqual({
      title: 'Pão de Mel',
      slug: 'pao-de-mel',
    })
  })

  it('sends no slug for a type with no slug field', () => {
    const type = { ...tagType, fields: [tagType.fields[0]!] }
    expect(referenceSlugField(type)).toBeUndefined()
    expect(referenceCreateBody(type, 'A', slugifyTitle)).toEqual({ title: 'A' })
  })
})

describe('withUnknownIds', () => {
  it('adds an option that shows the raw id', () => {
    const options = [{ label: 'Hiking', value: 'hiking' }]
    expect(withUnknownIds(options, ['hiking', 'gone', 'gone'])).toEqual([
      { label: 'Hiking', value: 'hiking' },
      { label: 'gone', value: 'gone' },
    ])
  })

  it('keeps the options when every id is known', () => {
    const options = [{ label: 'A', value: 1 }]
    expect(withUnknownIds(options, ['1'])).toEqual(options)
  })
})

describe('isReferenceCacheFresh', () => {
  it('is fresh for a recent read only', () => {
    expect(isReferenceCacheFresh(undefined, 100)).toBe(false)
    expect(isReferenceCacheFresh(100, 5_000)).toBe(true)
    expect(isReferenceCacheFresh(100, 20_000)).toBe(false)
  })
})
