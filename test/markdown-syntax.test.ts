import { describe, expect, it } from 'vitest'
import {
  findUnsafeMarkdown,
  insertMarkdownText,
  pickMarkdownEditorMode,
} from '../shared/utils/markdown-syntax'

const kinds = (text: string) =>
  findUnsafeMarkdown(text).map((issue) => issue.kind)

describe('findUnsafeMarkdown', () => {
  it('accepts plain CommonMark and strikethrough', () => {
    const text = [
      '# Title',
      '',
      'Some **bold**, *italic*, ~~strike~~ and `code`. A [link](https://example.com).',
      '',
      '- one',
      '- two',
      '',
      '1. first',
      '2. second',
      '',
      '> quote',
      '',
      '---',
      '',
      '```ts',
      'const a = 1',
      '```',
      '',
      'Time 10:30, url http://x.test/a:b and a rate of a:b.',
    ].join('\n')

    expect(findUnsafeMarkdown(text)).toEqual([])
    expect(findUnsafeMarkdown('')).toEqual([])
  })

  it('finds an MDC block', () => {
    expect(findUnsafeMarkdown('Text\n\n::note\nHello\n::\n')).toEqual([
      { kind: 'mdc-block', line: 3 },
    ])
    expect(kinds('  :::tabs\n')).toContain('mdc-block')
  })

  it('finds an inline MDC component', () => {
    expect(kinds('Use :icon{name="i-lucide-x"} here')).toEqual(['mdc-inline'])
    expect(kinds(':badge[New]{color=primary}')).toContain('mdc-inline')
    expect(kinds('A :kbd[Ctrl] key')).toEqual(['mdc-inline'])
  })

  it('finds attributes after a link, a span and inline code', () => {
    expect(kinds('[text](/a){.btn}')).toEqual(['attributes'])
    expect(kinds('[text]{.red}')).toEqual(['attributes'])
    expect(kinds('Use `code`{.hl} here')).toEqual(['attributes'])
  })

  it('finds HTML', () => {
    for (const text of [
      '<div class="a">x</div>',
      'a<br>b',
      '<img src="x" />',
      '<!-- note -->',
      '</section>',
    ]) {
      expect(kinds(text), text).toContain('html')
    }
  })

  it('does not flag an autolink or a lone angle bracket', () => {
    expect(
      findUnsafeMarkdown(
        '<https://example.com> and <me@example.com> and 1 < 2 > 0'
      )
    ).toEqual([])
  })

  it('finds a GFM table', () => {
    expect(findUnsafeMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |')).toEqual([
      { kind: 'table', line: 2 },
    ])
    expect(kinds('a | b\n:-: | --:\n1 | 2')).toEqual(['table'])
    // A thematic break is not a table.
    expect(findUnsafeMarkdown('text\n---\n')).toEqual([])
  })

  it('finds a task list', () => {
    expect(kinds('- [ ] todo\n- [x] done')).toEqual(['task-list'])
    expect(kinds('* [X] done')).toEqual(['task-list'])
    expect(findUnsafeMarkdown('- [link](x)')).toEqual([])
  })

  it('finds a footnote', () => {
    expect(kinds('Text[^1]\n\n[^1]: Note')).toEqual(['footnote'])
  })

  it('finds a fence with more than a language', () => {
    expect(kinds('```ts {1,3}\ncode\n```')).toEqual(['fence-meta'])
    expect(kinds('```js [app.js]\ncode\n```')).toEqual(['fence-meta'])
    expect(kinds('```ts title="a"\ncode\n```')).toEqual(['fence-meta'])
    expect(findUnsafeMarkdown('```ts\ncode\n```')).toEqual([])
    expect(findUnsafeMarkdown('```\ncode\n```')).toEqual([])
    expect(findUnsafeMarkdown('~~~c++\ncode\n~~~')).toEqual([])
  })

  it('ignores syntax inside a code fence and inside inline code', () => {
    const text = [
      '```md',
      '::note',
      '<div>x</div>',
      '- [ ] todo',
      '| a | b |',
      '| - | - |',
      '```',
      '',
      'Write `<div>` or `:icon{}` or `{x}` in code.',
    ].join('\n')

    expect(findUnsafeMarkdown(text)).toEqual([])
  })

  it('keeps scanning after a fence closes, and reports the line', () => {
    const text = '```md\n::x\n```\n\n::note\n'

    expect(findUnsafeMarkdown(text)).toEqual([{ kind: 'mdc-block', line: 5 }])
  })

  it('reports each kind once, with its first line', () => {
    const issues = findUnsafeMarkdown('<b>a</b>\n\n::x\n\n<i>b</i>')

    expect(issues).toEqual([
      { kind: 'html', line: 1 },
      { kind: 'mdc-block', line: 3 },
    ])
  })

  it('reads CRLF text', () => {
    expect(kinds('a\r\n\r\n::note\r\n')).toEqual(['mdc-block'])
  })
})

describe('insertMarkdownText', () => {
  it('replaces the selection and puts the caret after the snippet', () => {
    expect(
      insertMarkdownText('Hello world', { start: 6, end: 11 }, ':icon{}')
    ).toEqual({ value: 'Hello :icon{}', caret: 13 })
  })

  it('inserts at the caret', () => {
    expect(insertMarkdownText('ab', { start: 1, end: 1 }, 'X')).toEqual({
      value: 'aXb',
      caret: 2,
    })
  })

  it('puts a block on its own lines', () => {
    expect(
      insertMarkdownText(
        'Before\nAfter',
        { start: 7, end: 7 },
        '::note\nx\n::\n',
        { block: true }
      )
    ).toEqual({
      value: 'Before\n\n::note\nx\n::\n\nAfter',
      caret: 7 + 1 + '::note\nx\n::'.length,
    })
    expect(
      insertMarkdownText('Text', { start: 4, end: 4 }, '::x\n::', {
        block: true,
      }).value
    ).toBe('Text\n\n::x\n::')
    expect(
      insertMarkdownText('', { start: 0, end: 0 }, '::x\n::', { block: true })
        .value
    ).toBe('::x\n::')
    expect(
      insertMarkdownText('a\n\nb', { start: 3, end: 3 }, '::x', { block: true })
        .value
    ).toBe('a\n\n::x\n\nb')
  })

  it('clamps a selection outside the text', () => {
    expect(insertMarkdownText('ab', { start: 9, end: 20 }, 'X').value).toBe(
      'abX'
    )
  })
})

describe('pickMarkdownEditorMode', () => {
  it('keeps a fixed mode', () => {
    expect(pickMarkdownEditorMode('visual', '::note')).toBe('visual')
    expect(pickMarkdownEditorMode('source', 'plain')).toBe('source')
  })

  it('opens Source in auto mode only for unsafe text', () => {
    expect(pickMarkdownEditorMode('auto', '::note')).toBe('source')
    expect(pickMarkdownEditorMode(undefined, '<div>x</div>')).toBe('source')
    expect(pickMarkdownEditorMode('auto', 'plain **text**')).toBe('visual')
    expect(pickMarkdownEditorMode(undefined, '')).toBe('visual')
  })
})
