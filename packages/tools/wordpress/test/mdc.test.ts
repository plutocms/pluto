import { describe, expect, it } from 'vitest'
import { colonsOf, serializeBlocks } from '../src/mdc'
import { RAW_HTML } from '../src/types'

describe('serializeBlocks', () => {
  it('writes a leaf block with two colons', () => {
    expect(
      serializeBlocks([
        { name: 'block-button', props: { label: 'Go', link: '/go' } },
      ])
    ).toBe('::block-button{label="Go" link="/go"}\n::')
  })

  it('writes the text of a block as its slot', () => {
    expect(
      serializeBlocks([
        { name: 'block-heading', props: { level: '2' }, text: 'A title' },
      ])
    ).toBe('::block-heading{level="2"}\nA title\n::')
  })

  it('writes true as a bare key, false and numbers as values, and kebab-case keys', () => {
    expect(
      serializeBlocks([
        {
          name: 'block-section',
          props: {
            overlayOpacity: 40,
            minHeight: '60vh',
            open: true,
            wrap: false,
            skip: undefined,
          },
        },
      ])
    ).toBe(
      '::block-section{overlay-opacity="40" min-height="60vh" open :wrap="false"}\n::'
    )
  })

  it('quotes a value with a double quote in single quotes', () => {
    expect(
      serializeBlocks([
        { name: 'block-button', props: { label: 'A "big" one' } },
      ])
    ).toBe(`::block-button{label='A "big" one'}\n::`)
  })

  it('keeps a value on one line', () => {
    expect(
      serializeBlocks([{ name: 'block-button', props: { label: 'a\n  b' } }])
    ).toBe('::block-button{label="a b"}\n::')
  })

  it('counts the colons from the deepest child', () => {
    const button = { name: 'block-button', props: {} }
    const column = { name: 'block-column', props: {}, children: [button] }
    const columns = { name: 'block-columns', props: {}, children: [column] }
    const section = { name: 'block-section', props: {}, children: [columns] }

    expect([button, column, columns, section].map(colonsOf)).toEqual([
      2, 3, 4, 5,
    ])
    expect(serializeBlocks([section])).toBe(
      [
        ':::::block-section',
        '::::block-columns',
        ':::block-column',
        '::block-button',
        '::',
        ':::',
        '::::',
        ':::::',
      ].join('\n')
    )
  })

  it('separates blocks with a blank line', () => {
    const mdc = serializeBlocks([
      { name: 'block-spacer', props: {} },
      { name: 'block-divider', props: {} },
    ])

    expect(mdc).toBe('::block-spacer\n::\n\n::block-divider\n::')
  })

  it('escapes a line of a text that would open a block, and a first line that is a rule', () => {
    expect(
      serializeBlocks([
        { name: 'block-text', props: {}, text: '---\nline\n::foo' },
      ])
    ).toBe('::block-text\n***\nline\n\\::foo\n::')
  })

  it('writes raw HTML as it is', () => {
    expect(
      serializeBlocks([{ name: RAW_HTML, props: {}, text: '<p>Hi</p>' }])
    ).toBe('<p>Hi</p>')
  })
})
