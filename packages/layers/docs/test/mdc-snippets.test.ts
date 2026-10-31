import { describe, expect, it } from 'vitest'
import { MDC_SNIPPETS } from '../shared/utils/mdc-snippets'

describe('mdc snippets', () => {
  it('has the snippets of the Insert menu', () => {
    expect(MDC_SNIPPETS.map((snippet) => snippet.id)).toEqual([
      'note',
      'tip',
      'warning',
      'caution',
      'callout',
      'code-group',
      'tabs',
      'steps',
      'card-group',
      'accordion',
      'field-group',
      'kbd',
      'icon',
      'code-file',
    ])
  })

  it('has unique ids and i18n keys of this layer', () => {
    expect(new Set(MDC_SNIPPETS.map((snippet) => snippet.id)).size).toBe(
      MDC_SNIPPETS.length
    )
    for (const snippet of MDC_SNIPPETS) {
      expect(snippet.label).toMatch(/^docs.snippets\./)
    }
  })

  it('closes every block component', () => {
    for (const snippet of MDC_SNIPPETS.filter((entry) =>
      entry.text.startsWith('::')
    )) {
      const lines = snippet.text.split('\n')
      const opens = lines.filter((line) => /^\s*:{2,}[a-z]/.test(line)).length
      const closes = lines.filter((line) => /^\s*:{2,}$/.test(line)).length
      expect(closes, snippet.id).toBe(opens)
    }
  })

  it('marks the inline snippets', () => {
    expect(
      MDC_SNIPPETS.filter((snippet) => !snippet.block).map(
        (snippet) => snippet.id
      )
    ).toEqual(['kbd', 'icon'])
  })
})
