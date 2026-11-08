import type { PlutoContentType } from '../shared/types/content'
import { describe, expect, it } from 'vitest'
import { applyContentTypeExtensions } from '../shared/utils/content-extend'
import {
  standardFieldNames,
  withStandardFields,
  withStandardPublicKeys,
} from '../shared/utils/content-standard'

function makeType(overrides: Partial<PlutoContentType> = {}): PlutoContentType {
  return {
    name: 'note',
    label: 'Note',
    labelPlural: 'Notes',
    source: 'notes',
    titleField: 'title',
    fields: [
      { name: 'title', type: 'text', label: 'Title' },
      { name: 'body', type: 'richtext', label: 'Body' },
    ],
    ...overrides,
  } as PlutoContentType
}

describe('standardFieldNames', () => {
  it('gives the default or the chosen field names, and nothing when off', () => {
    expect(
      standardFieldNames(makeType({ excerpt: true, cover: true }))
    ).toEqual({ excerpt: 'excerpt', cover: 'cover' })
    expect(
      standardFieldNames(
        makeType({ excerpt: { field: 'summary' }, cover: { field: 'hero' } })
      )
    ).toEqual({ excerpt: 'summary', cover: 'hero' })
    expect(standardFieldNames(makeType())).toEqual({})
  })
})

describe('withStandardFields', () => {
  it('adds a missing excerpt and cover field in the side panel', () => {
    const type = withStandardFields(makeType({ excerpt: true, cover: true }))

    expect(type.fields.map((field) => [field.name, field.type])).toEqual([
      ['title', 'text'],
      ['body', 'richtext'],
      ['excerpt', 'textarea'],
      ['cover', 'media'],
    ])
    expect(type.fields[3]).toMatchObject({
      accept: ['image/*'],
      region: 'side',
    })
  })

  it('keeps a declared field, and the same object when nothing changes', () => {
    const declared = makeType({
      excerpt: true,
      fields: [
        { name: 'title', type: 'text', label: 'Title' },
        { name: 'excerpt', type: 'text', label: 'Teaser' },
      ] as PlutoContentType['fields'],
    })
    expect(withStandardFields(declared)).toBe(declared)
    const plain = makeType()
    expect(withStandardFields(plain)).toBe(plain)
  })

  it('runs in the registry path (applyContentTypeExtensions)', () => {
    expect(
      applyContentTypeExtensions(makeType({ cover: true }), []).fields.map(
        (field) => field.name
      )
    ).toEqual(['title', 'body', 'cover'])
  })
})

describe('withStandardPublicKeys', () => {
  const type = withStandardFields(
    makeType({ excerpt: { field: 'summary' }, cover: { field: 'hero' } })
  )
  const record = { id: 'm1', url: '/m1.jpg' }

  it('gives the excerpt field, and the cover record under cover', () => {
    expect(
      withStandardPublicKeys(
        type,
        { id: 1, summary: '  Short.  ', hero: record },
        { id: 1, body: '# Long body' }
      )
    ).toMatchObject({ excerpt: 'Short.', cover: record })
  })

  it('falls back to the start of the body as plain text, or keeps an excerpt of the adapter', () => {
    expect(
      withStandardPublicKeys(
        type,
        { id: 1, summary: '' },
        { id: 1, body: '# Title\n\nSome **bold** text.' }
      ).excerpt
    ).toBe('Title Some bold text.')
    expect(
      withStandardPublicKeys(
        type,
        { id: 1, excerpt: 'From the adapter' },
        { id: 1, body: 'Body' }
      ).excerpt
    ).toBe('From the adapter')
  })

  it('changes nothing for a type without the options', () => {
    const data = { id: 1, body: 'x' }
    expect(withStandardPublicKeys(makeType(), data, { id: 1 })).toBe(data)
  })
})
