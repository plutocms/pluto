import { describe, expect, it } from 'vitest'
import {
  matchBlankLink,
  withoutBlankLinkAttributes,
} from '../shared/markdown/link-target'
import { renderMarkdown } from '../shared/markdown/render'
import { sanitizeHtml } from '../shared/markdown/sanitize-html'
import { findUnsafeMarkdown } from '../shared/utils/markdown-syntax'

describe('a link that opens in a new tab', () => {
  it('matches the form the editor writes', () => {
    expect(matchBlankLink('[a](/b){target="_blank"} c')).toEqual({
      raw: '[a](/b){target="_blank"}',
      link: '[a](/b)',
    })
    expect(matchBlankLink('[a](/b "T"){target="_blank"}')?.link).toBe(
      '[a](/b "T")'
    )
    expect(matchBlankLink('[a](/b){target="_self"}')).toBeUndefined()
    expect(matchBlankLink('[a](/b)')).toBeUndefined()
  })

  it('renders target and a safe rel', () => {
    expect(
      renderMarkdown('See [the docs](https://a.dev){target="_blank"} now.')
    ).toBe(
      '<p>See <a href="https://a.dev" target="_blank" rel="noopener noreferrer">the docs</a> now.</p>\n'
    )
  })

  it('keeps marks and a title inside the link', () => {
    expect(
      renderMarkdown('[**bold** docs](https://a.dev "T"){target="_blank"}')
    ).toContain(
      '<a href="https://a.dev" title="T" target="_blank" rel="noopener noreferrer"><strong>bold</strong> docs</a>'
    )
  })

  it('reads the other MDC forms of the attribute', () => {
    expect(renderMarkdown('[a](https://a.dev){target=_blank .x}')).toContain(
      'target="_blank"'
    )
  })

  it('drops other attributes, as before', () => {
    expect(renderMarkdown('[a](https://a.dev){.x}')).toBe(
      '<p><a href="https://a.dev">a</a></p>\n'
    )
  })

  it('keeps the unsafe address check', () => {
    expect(renderMarkdown('[x](javascript:alert(1)){target="_blank"}')).not.toContain(
      'javascript'
    )
  })

  it('sanitizes any other target and any rel', () => {
    expect(
      sanitizeHtml('<a href="https://a" target="_top" rel="opener">y</a>')
    ).toBe('<a href="https://a">y</a>')
    expect(
      sanitizeHtml('<a href="https://a" target="_blank" rel="opener">y</a>')
    ).toBe(
      '<a href="https://a" target="_blank" rel="noopener noreferrer">y</a>'
    )
  })

  it('does not lock a post to the Markdown mode', () => {
    expect(
      withoutBlankLinkAttributes('[a](/b){target="_blank"} and [c](/d)')
    ).toBe('[a](/b) and [c](/d)')
    expect(findUnsafeMarkdown('See [a](/b){target="_blank"}.')).toEqual([])
    expect(findUnsafeMarkdown('See [a](/b){.x}.')).toEqual([
      { kind: 'attributes', line: 1 },
    ])
  })
})
