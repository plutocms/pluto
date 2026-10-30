import type { PlutoMarkdownFormat } from '../shared/utils/markdown-format'
import { describe, expect, it } from 'vitest'
import { formatMarkdown, minimalChange } from '../shared/utils/markdown-format'
import { mdcLineKinds } from '../shared/utils/mdc-lines'

/** Applies a format to the text with the selection between `[` and `]`, and gives the new text and selection. */
function apply(marked: string, format: PlutoMarkdownFormat): string {
  const from = marked.indexOf('[')
  const to = marked.indexOf(']') - 1
  const text = marked.replace('[', '').replace(']', '')
  const edit = formatMarkdown(text, from, to, format)
  const next = text.slice(0, edit.from) + edit.insert + text.slice(edit.to)
  const { anchor, head } = edit.selection
  return `${next.slice(0, anchor)}[${next.slice(anchor, head)}]${next.slice(head)}`
}

describe('inline formats', () => {
  it('wraps the selection and keeps it selected', () => {
    expect(apply('a [word] b', 'bold')).toBe('a **[word]** b')
    expect(apply('a [word] b', 'italic')).toBe('a _[word]_ b')
    expect(apply('a [word] b', 'strike')).toBe('a ~~[word]~~ b')
    expect(apply('a [word] b', 'code')).toBe('a `[word]` b')
  })

  it('removes the marks when they are around the selection or in it', () => {
    expect(apply('a **[word]** b', 'bold')).toBe('a [word] b')
    expect(apply('a [**word**] b', 'bold')).toBe('a [word] b')
  })

  it('puts the caret between the marks for an empty selection', () => {
    expect(apply('a [] b', 'bold')).toBe('a **[]** b')
  })
})

describe('links', () => {
  it('selects the URL after a link around the selection', () => {
    expect(apply('see [the docs] now', 'link')).toBe(
      'see [the docs]([https://]) now'
    )
  })

  it('selects the text of a new link', () => {
    expect(apply('see []', 'link')).toBe('see [[text]](https://)')
  })
})

describe('line formats', () => {
  it('adds and removes a bullet on each line', () => {
    expect(apply('[one\ntwo]', 'bullet')).toBe('[- one\n- two]')
    expect(apply('[- one\n- two]', 'bullet')).toBe('[one\ntwo]')
  })

  it('numbers the lines, and changes a bullet to a number', () => {
    expect(apply('[one\n- two\n\nthree]', 'number')).toBe(
      '[1. one\n2. two\n\n3. three]'
    )
  })

  it('uses the whole line of a caret', () => {
    expect(apply('first\nsec[]ond\nlast', 'quote')).toBe(
      'first\n[> second]\nlast'
    )
  })

  it('cycles the heading level', () => {
    expect(apply('[Title]', 'heading')).toBe('[## Title]')
    expect(apply('[## Title]', 'heading')).toBe('[### Title]')
    expect(apply('[### Title]', 'heading')).toBe('[Title]')
  })

  it('wraps lines in a code block, and removes it', () => {
    expect(apply('[let a = 1]', 'codeblock')).toBe('[```\nlet a = 1\n```]')
    expect(apply('[```\nlet a = 1\n```]', 'codeblock')).toBe('[let a = 1]')
  })

  it('puts the caret in a new empty code block', () => {
    expect(apply('[]', 'codeblock')).toBe('```\n[]\n```')
  })
})

describe('minimalChange', () => {
  it('keeps the same start and end', () => {
    expect(minimalChange('abcXdef', 'abcYYdef')).toEqual({
      from: 3,
      to: 4,
      insert: 'YY',
    })
    expect(minimalChange('same', 'same')).toEqual({
      from: 4,
      to: 4,
      insert: '',
    })
  })
})

describe('mdcLineKinds', () => {
  it('marks components, slots, props and code', () => {
    const text = [
      'Intro',
      '::u-page-section',
      '---',
      'title: Two modes',
      '---',
      '#features',
      '  :::u-page-card{to="/a"}',
      '  Text',
      '  :::',
      '::',
      '```md',
      '::not-a-component',
      '```',
      '---',
    ].join('\n')
    expect(mdcLineKinds(text)).toEqual([
      undefined,
      'component',
      'props',
      'props',
      'props',
      'slot',
      'component',
      undefined,
      'component',
      'component',
      'code',
      'code',
      'code',
      undefined,
    ])
  })

  it('does not take a heading or a rule for a slot or props', () => {
    expect(mdcLineKinds('# Title\n\n---\n\nText')).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ])
  })
})
