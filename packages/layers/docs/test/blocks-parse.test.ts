import type { PlutoComponentBlock } from '../shared/utils/blocks/types'
import { describe, expect, it } from 'vitest'
import {
  isEqualValue,
  parseInlineProps,
  parseOpener,
  parseYamlProps,
  renderInlineProps,
  renderInlineToken,
} from '../shared/utils/blocks/mdc-props'
import { parseBlocks } from '../shared/utils/blocks/parse'
import { serializeBlocks } from '../shared/utils/blocks/serialize'
import { flatChildren } from '../shared/utils/blocks/tree'

describe('parseBlocks', () => {
  it('cuts a Text block at each H1 and H2, and joins the rest', () => {
    const source =
      'Intro.\n\n# One\n\nText.\n\n- a\n- b\n\n## Two\n\nMore.\n\n### Three\n\nStill the same block.\n'
    const doc = parseBlocks(source)
    expect(doc.blocks.map((block) => block.kind)).toEqual([
      'text',
      'text',
      'text',
    ])
    expect(
      doc.blocks.map(
        (block) => (block as { markdown: string }).markdown.split('\n')[0]
      )
    ).toEqual(['Intro.', '# One', '## Two'])
    expect(doc.blocks[2]).toMatchObject({
      markdown: '## Two\n\nMore.\n\n### Three\n\nStill the same block.',
    })
    expect(doc.gaps).toEqual(['', '\n\n', '\n\n', '\n'])
  })

  it('makes a Code block with language, file name and meta', () => {
    const doc = parseBlocks(
      '```ts [file.ts] {1,2}\nconst a = 1\n```\n\n~~~~md\n```\n~~~~\n'
    )
    expect(doc.blocks[0]).toMatchObject({
      kind: 'code',
      lang: 'ts',
      filename: 'file.ts',
      meta: '{1,2}',
      fence: '```',
      code: 'const a = 1',
    })
    expect(doc.blocks[1]).toMatchObject({
      kind: 'code',
      lang: 'md',
      fence: '~~~~',
      code: '```',
    })
  })

  it('keeps tables, HTML and inline MDC as Markdown (raw) blocks', () => {
    const source =
      '| a | b |\n| - | - |\n| 1 | 2 |\n\n<div>html</div>\n\nPress :kbd{value="Ctrl"} now.\n\n- [ ] task\n\nText[^1].\n\n[^1]: Note.\n'
    const doc = parseBlocks(source)
    expect(
      doc.blocks.map((block) =>
        block.kind === 'raw' ? block.reason : block.kind
      )
    ).toEqual([
      'table',
      'html',
      'inline-mdc',
      'task-list',
      'footnote',
      'footnote',
    ])
    expect(serializeBlocks(doc)).toBe(source)
  })

  it('reads an inline component with props, class and id', () => {
    const doc = parseBlocks(
      '::note{icon="i-lucide-info" .wide .big #top open :cols=\'3\'}\nText.\n::\n'
    )
    expect(doc.blocks[0]).toMatchObject({
      kind: 'component',
      name: 'note',
      propsStyle: 'inline',
      colons: 2,
      props: {
        icon: 'i-lucide-info',
        class: 'wide big',
        id: 'top',
        open: true,
        cols: 3,
      },
      propOrder: ['icon', 'class', 'id', 'open', 'cols'],
    })
  })

  it('reads the YAML props of a component', () => {
    const doc = parseBlocks(
      '::card\n---\ntitle: "A: b"\nicon: i-lucide-box\nitems:\n  - one\n  - two\n---\nText.\n::\n'
    )
    const card = doc.blocks[0] as PlutoComponentBlock
    expect(card).toMatchObject({
      propsStyle: 'yaml',
      props: { title: 'A: b', icon: 'i-lucide-box', items: ['one', 'two'] },
      propOrder: ['title', 'icon', 'items'],
    })
    expect(card.propSource.items!.text).toBe('items:\n  - one\n  - two')
    expect(flatChildren(card)).toHaveLength(1)
  })

  it('reads the slots, in source order, and the explicit default slot', () => {
    const doc = parseBlocks(
      '::u-page-hero\n#headline\nSmall.\n\n#title\nBig.\n\n#default\n  :::u-button{label="Go"}\n  :::\n::\n'
    )
    const hero = doc.blocks[0] as PlutoComponentBlock
    expect(Object.keys(hero.slots)).toEqual(['headline', 'title', 'default'])
    expect(hero.slots.default![0]).toMatchObject({
      kind: 'component',
      name: 'u-button',
      indent: '  ',
      colons: 3,
    })
    expect(hero.gaps).toHaveLength(4)
  })

  it('reads nested components with more colons', () => {
    const doc = parseBlocks(
      '::::tabs\n:::tabs-item{label="A"}\nOne.\n:::\n\n:::tabs-item{label="B"}\nTwo.\n:::\n::::\n'
    )
    const tabs = doc.blocks[0] as PlutoComponentBlock
    expect(tabs.colons).toBe(4)
    expect(
      flatChildren(tabs).map((child) =>
        child.kind === 'component' ? child.props.label : ''
      )
    ).toEqual(['A', 'B'])
  })

  it('keeps a component it cannot read as a raw block', () => {
    const source = '::note\nText.\n'
    const doc = parseBlocks(source)
    expect(serializeBlocks(doc)).toBe(source)
  })

  it('handles an empty text, a text with blank lines only and a missing final newline', () => {
    expect(parseBlocks('')).toEqual({ blocks: [], gaps: [''] })
    expect(serializeBlocks(parseBlocks('\n\n  \n'))).toBe('\n\n  \n')
    expect(serializeBlocks(parseBlocks('No newline'))).toBe('No newline')
  })

  it('numbers the blocks in source order, with unique ids', () => {
    const doc = parseBlocks('A\n\n## B\n\n::note\nC\n::\n')
    expect(doc.blocks.map((block) => block.id)).toEqual(['b0', 'b1', 'b3'])
  })
})

describe('mdc props', () => {
  it('reads an opening line', () => {
    expect(parseOpener('::note')).toEqual({
      colons: 2,
      name: 'note',
      braces: undefined,
    })
    expect(parseOpener(':::tabs-item{label="A b"}')).toEqual({
      colons: 3,
      name: 'tabs-item',
      braces: 'label="A b"',
    })
    expect(parseOpener('::note[text]')).toBeUndefined()
    expect(parseOpener('text')).toBeUndefined()
  })

  it('reads quoted values with spaces and braces', () => {
    const parsed = parseInlineProps(
      'title="A b {c}" other=\'x "y"\' bare=word flag'
    )
    expect(parsed.props).toEqual({
      title: 'A b {c}',
      other: 'x "y"',
      bare: 'word',
      flag: true,
    })
  })

  it('writes a value as a token', () => {
    expect(renderInlineToken('a', 'x')).toBe('a="x"')
    expect(renderInlineToken('a', true)).toBe('a')
    expect(renderInlineToken('a', 3)).toBe(":a='3'")
    expect(renderInlineToken('a', ['x', "it's"])).toBe(
      ':a=\'["x","it\\u0027s"]\''
    )
    expect(renderInlineToken('a', undefined)).toBeUndefined()
    // A written value reads back the same.
    for (const value of [
      'plain',
      'with "double"',
      "with 'single'",
      true,
      4,
      [1, 2],
      { a: 'b' },
      'two\nlines',
    ]) {
      const token = renderInlineToken('k', value)!
      expect(parseInlineProps(token).props.k).toEqual(value)
    }
  })

  it('keeps the text of a prop that did not change', () => {
    const parsed = parseInlineProps('a=b   .x  c="d"')
    expect(
      renderInlineProps(
        { ...parsed.props, c: 'e' },
        parsed.order,
        parsed.source
      )
    ).toBe('a=b .x c="e"')
  })

  it('reads YAML with the text of each entry', () => {
    const parsed = parseYamlProps('a: 1\nb: |\n  long\n  text\nc: x # note')!
    expect(parsed.props).toEqual({ a: 1, b: 'long\ntext\n', c: 'x' })
    expect(parsed.source.b!.text).toBe('b: |\n  long\n  text')
    expect(parseYamlProps('a: [')).toBeUndefined()
    expect(parseYamlProps('- a\n- b')).toBeUndefined()
  })

  it('compares values deeply', () => {
    expect(isEqualValue({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true)
    expect(isEqualValue({ a: 1 }, { a: 2 })).toBe(false)
    expect(isEqualValue([1], { 0: 1 })).toBe(false)
  })
})
