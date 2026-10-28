import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../shared/markdown/render'
import { plutoMarkdownHeadings } from '../shared/utils/markdown-headings'

describe('plutoMarkdownHeadings', () => {
  it('finds ATX and setext headings with their level and line', () => {
    const markdown = [
      '# Title',
      '',
      'Text',
      '',
      'Second',
      '======',
      '',
      'Third',
      '---',
      '### **Bold** and `code` ###',
    ].join('\n')
    expect(plutoMarkdownHeadings(markdown)).toEqual([
      { level: 1, text: 'Title', line: 0 },
      { level: 1, text: 'Second', line: 4 },
      { level: 2, text: 'Third', line: 7 },
      { level: 3, text: 'Bold and code', line: 9 },
    ])
  })

  it('skips lines inside fenced code, and a hash without text', () => {
    const markdown = [
      '```md',
      '# Not a heading',
      '```',
      '#',
      '## [Link](/x)',
    ].join('\n')
    expect(plutoMarkdownHeadings(markdown)).toEqual([
      { level: 2, text: 'Link', line: 4 },
    ])
  })

  it('does not read a hash with no space as a heading', () => {
    expect(plutoMarkdownHeadings('#hashtag\n\n####### seven')).toEqual([])
  })

  it('matches the order of the headings in the rendered HTML', () => {
    const markdown = '# A\n\n```\n# code\n```\n\nB\n---\n\n## C'
    const html = renderMarkdown(markdown)
    const rendered = [...html.matchAll(/<h([1-6])[^>]*>(.*?)<\/h\1>/g)].map(
      (match) => match[2]
    )
    expect(
      plutoMarkdownHeadings(markdown).map((heading) => heading.text)
    ).toEqual(rendered)
  })
})
