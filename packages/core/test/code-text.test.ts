import { describe, expect, it } from 'vitest'
import { plutoCodeTextParts } from '../shared/utils/code-text'

describe('plutoCodeTextParts', () => {
  it('splits text and code', () => {
    expect(plutoCodeTextParts('Set `NAME` in `.env`.')).toEqual([
      { code: false, text: 'Set ' },
      { code: true, text: 'NAME' },
      { code: false, text: ' in ' },
      { code: true, text: '.env' },
      { code: false, text: '.' },
    ])
  })

  it('keeps a text with no backticks as one part', () => {
    expect(plutoCodeTextParts('Plain text')).toEqual([
      { code: false, text: 'Plain text' },
    ])
  })

  it('keeps an unclosed backtick as text, and drops an empty pair', () => {
    expect(plutoCodeTextParts('a `b')).toEqual([{ code: false, text: 'a `b' }])
    expect(plutoCodeTextParts('a `` b')).toEqual([
      { code: false, text: 'a ' },
      { code: false, text: ' b' },
    ])
  })

  it('gives nothing for an empty text', () => {
    expect(plutoCodeTextParts('')).toEqual([])
  })
})
