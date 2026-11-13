import { describe, expect, it } from 'vitest'
import {
  contentTypeExports,
  contentTypesTemplate,
} from '../modules/pluto-content-types/scan'

describe('contentTypeExports', () => {
  it('finds each export declared with defineContentType', () => {
    const text = [
      "export const contactType = defineContentType({ name: 'contact' })",
      'export const postType: PlutoContentType = defineContentType({',
      "export const noteType = defineContentType<PlutoContentType>({ name: 'note' })",
      'export const other = makeType()',
      '// export const commented = defineContentType({})',
      '/* export const blocked = defineContentType({}) */',
    ].join('\n')

    expect(contentTypeExports(text)).toEqual([
      'contactType',
      'postType',
      'noteType',
    ])
  })
})

describe('contentTypesTemplate', () => {
  it('gives an empty module with no type', () => {
    expect(contentTypesTemplate([], (file) => file)).not.toContain(
      'PlutoContentTypes'
    )
  })

  it('adds each declared type to the global map', () => {
    const text = contentTypesTemplate(
      [{ exportName: 'contactType', file: '/app/shared/utils/contact.ts' }],
      () => '../../shared/utils/contact'
    )

    expect(text).toContain(
      'typeof import("../../shared/utils/contact")["contactType"]'
    )
    expect(text).toContain(
      'interface PlutoContentTypes extends PlutoDeclaredContentTypes {}'
    )
  })
})
