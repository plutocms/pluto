import { describe, expect, it } from 'vitest'
import { parseMarkdownFile, serializeMarkdownFile } from '../modules/pluto-github/runtime/server/utils/markdown-file'

describe('parseMarkdownFile', () => {
  it('splits frontmatter and body', () => {
    const result = parseMarkdownFile('---\ntitle: Hello\nstatus: draft\n---\n# Body\n')

    expect(result.frontmatter).toEqual({ title: 'Hello', status: 'draft' })
    expect(result.body).toBe('# Body\n')
  })

  it('tolerates a file with no frontmatter', () => {
    expect(parseMarkdownFile('# Just text\n')).toEqual({ frontmatter: {}, body: '# Just text\n' })
    expect(parseMarkdownFile('')).toEqual({ frontmatter: {}, body: '' })
  })

  it('handles empty frontmatter', () => {
    expect(parseMarkdownFile('---\n---\nbody')).toEqual({ frontmatter: {}, body: 'body' })
  })

  it('splits at the first closing fence only', () => {
    const result = parseMarkdownFile('---\ntitle: A\n---\nText\n\n---\n\nMore\n---\n')

    expect(result.frontmatter).toEqual({ title: 'A' })
    expect(result.body).toBe('Text\n\n---\n\nMore\n---\n')
  })

  it('normalizes line endings and a BOM', () => {
    const result = parseMarkdownFile('﻿---\r\ntitle: A\r\n---\r\nline1\r\nline2\r\n')

    expect(result.frontmatter).toEqual({ title: 'A' })
    expect(result.body).toBe('line1\nline2\n')
  })

  it('throws on invalid YAML or a non-map', () => {
    expect(() => parseMarkdownFile('---\ntitle: [unclosed\n---\n')).toThrow()
    expect(() => parseMarkdownFile('---\n- a\n- b\n---\n')).toThrow()
  })

  it('does not run a YAML tag', () => {
    const result = parseMarkdownFile('---\nfn: !!js/function "function () { globalThis.__pwned = 1 }"\n---\n')

    expect(typeof result.frontmatter.fn).toBe('string')
    expect((globalThis as Record<string, unknown>).__pwned).toBeUndefined()
  })
})

describe('serializeMarkdownFile', () => {
  it('writes the keys in insertion order', () => {
    expect(serializeMarkdownFile({ title: 'A', status: 'draft' }, 'Body\n')).toBe('---\ntitle: A\nstatus: draft\n---\nBody\n')
  })

  it('writes no fence for empty frontmatter', () => {
    expect(serializeMarkdownFile({}, 'Body')).toBe('Body')
  })

  it('round trips and stays stable', () => {
    const text = '---\ntitle: Hello\ntags:\n  - a\n  - b\ndate: 2026-01-02\ncount: 3\nok: true\n---\nBody\n\n---\n\nMore\n'
    const once = parseMarkdownFile(text)
    const written = serializeMarkdownFile(once.frontmatter, once.body)
    const twice = parseMarkdownFile(written)

    expect(twice).toEqual(once)
    expect(serializeMarkdownFile(twice.frontmatter, twice.body)).toBe(written)
  })

  it('keeps hostile string values as plain data', () => {
    const values = [
      'a --- b',
      '---',
      'line1\nline2\n---\nkey: injected',
      'key: value',
      'with # hash',
      '!tag',
      '!!js/function () {}',
      '&anchor',
      '*alias',
      '- item',
      '"quoted"',
      '  padded  ',
      'null',
      'true',
      '123',
    ]
    for (const value of values) {
      const written = serializeMarkdownFile({ title: value, other: 'safe' }, 'Body\n')
      const parsed = parseMarkdownFile(written)

      expect(parsed.frontmatter, value).toEqual({ title: value, other: 'safe' })
      expect(parsed.body, value).toBe('Body\n')
    }
  })

  it('keeps hostile keys and nested values as data', () => {
    const frontmatter = { 'a: b': ['x # y', { '---': '!!str' }] }
    const parsed = parseMarkdownFile(serializeMarkdownFile(frontmatter, ''))

    expect(parsed.frontmatter).toEqual(frontmatter)
  })
})
