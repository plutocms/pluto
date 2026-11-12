import { describe, expect, it } from 'vitest'
import { sanitizeHighlightHtml } from '../../../../core/shared/markdown/sanitize-highlight'
import { highlightWithLowlight } from '../server/utils/lowlight'

describe('highlightWithLowlight', () => {
  it('gives the spans of a known language, with its alias', () => {
    const html = highlightWithLowlight({ code: 'const a = 1', lang: 'ts' })
    expect(html).toBe(
      '<span class="hljs-keyword">const</span> a = <span class="hljs-number">1</span>'
    )
  })

  it('escapes the code', () => {
    expect(
      highlightWithLowlight({ code: 'a < b && "<script>"', lang: 'javascript' })
    ).not.toContain('<script>')
  })

  it('gives nothing for a language it does not know, or none', () => {
    expect(highlightWithLowlight({ code: 'x', lang: 'klingon' })).toBeNull()
    expect(highlightWithLowlight({ code: 'x', lang: '' })).toBeNull()
  })

  it('passes the allowlist of core as it is', () => {
    const html = highlightWithLowlight({
      code: 'def add(a, b):\n    return a + b  # sum',
      lang: 'py',
    })!
    expect(sanitizeHighlightHtml(html)).toBe(html)
  })
})
