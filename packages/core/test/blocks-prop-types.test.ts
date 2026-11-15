import type { Node } from 'comark'
import { parseMarkdown } from 'comark'
import { describe, expect, it } from 'vitest'
import {
  coerceBlockProps,
  coerceNodeProps,
} from '../shared/utils/blocks/prop-types'

const definition = {
  props: {
    columns: { type: 'number' as const },
    starCount: { type: 'number' as const },
    center: { type: 'boolean' as const },
    title: { type: 'string' as const },
  },
}

describe('coerceBlockProps', () => {
  it('turns number and boolean text into numbers and booleans', () => {
    expect(
      coerceBlockProps(
        { columns: '2', center: 'false', title: '5', other: '7' },
        definition
      )
    ).toEqual({ columns: 2, center: false, title: '5', other: '7' })
  })

  it('keeps a value that does not parse', () => {
    expect(
      coerceBlockProps({ columns: 'many', center: 'yes', starCount: '' }, definition)
    ).toEqual({ columns: 'many', center: 'yes', starCount: '' })
  })

  it('reads a kebab prop with a camel definition', () => {
    expect(coerceBlockProps({ 'star-count': '4' }, definition)).toEqual({
      'star-count': 4,
    })
  })

  it('turns a bare attribute into true', () => {
    expect(coerceBlockProps({ ':center': 'true' }, definition)).toEqual({
      center: true,
    })
  })

  it('returns the props as they are with no definition', () => {
    const props = { columns: '2' }
    expect(coerceBlockProps(props, undefined)).toBe(props)
  })
})

describe('coerceNodeProps', () => {
  it('reaches nested components and slots, and reads real Comark nodes', async () => {
    const { nodes } = await parseMarkdown(
      '::card-group{columns=2 center}\n  :::card{columns=3}\n  Text\n  :::\n::\n',
      { autoUnwrap: false }
    )
    const out = coerceNodeProps(nodes, () => definition) as Node[]
    const group = out[0] as [string, Record<string, unknown>, ...Node[]]
    expect(group[1]).toMatchObject({ columns: 2, center: true })
    const card = group[2] as [string, Record<string, unknown>]
    expect(card[1]).toMatchObject({ columns: 3 })
  })
})
