import type { PlutoContentType } from '../shared/types/content'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineContentType } from '../shared/utils/content'

function baseType(overrides: Partial<PlutoContentType> = {}): PlutoContentType {
  return {
    name: 'post',
    label: 'Post',
    labelPlural: 'Posts',
    source: 'posts',
    titleField: 'title',
    fields: [{ name: 'title', type: 'text', label: 'Title' }],
    ...overrides,
  }
}

describe('defineContentType', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns its input unchanged (identity)', () => {
    const type = baseType()
    expect(defineContentType(type)).toBe(type)
    expect(console.warn).not.toHaveBeenCalled()
  })

  it.each([
    {
      case: 'duplicate field name',
      type: baseType({
        fields: [
          { name: 'title', type: 'text', label: 'Title' },
          { name: 'title', type: 'text', label: 'Title again' },
        ],
      }),
    },
    {
      case: 'titleField not matching any field',
      type: baseType({ titleField: 'missing' }),
    },
    {
      case: 'slug.field not naming a slug field',
      type: baseType({
        slug: { field: 'title' },
        fields: [{ name: 'title', type: 'text', label: 'Title' }],
      }),
    },
    {
      case: 'select field with empty options',
      type: baseType({
        fields: [
          { name: 'title', type: 'text', label: 'Title' },
          { name: 'kind', type: 'select', label: 'Kind', options: [] },
        ],
      }),
    },
    {
      case: 'status with empty values',
      type: baseType({ status: { values: [] } }),
    },
  ])('warns on $case', ({ type }) => {
    const result = defineContentType(type)

    expect(console.warn).toHaveBeenCalledTimes(1)
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('"post"'))
    expect(result).toBe(type)
  })
})
