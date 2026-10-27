import { describe, expect, it } from 'vitest'
import { markdownToPlainText, renderMarkdown, stripMdc } from '../modules/pluto-github/runtime/server/utils/markdown'

describe('renderMarkdown', () => {
  it('renders headings, emphasis and lists', () => {
    const html = renderMarkdown('# Title\n\nSome **bold** and *italic* text.\n\n- one\n- two\n\n1. first\n2. second\n')

    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
    expect(html).toContain('<ul>')
    expect(html).toContain('<ol>')
    expect(html).toContain('<li>one</li>')
  })

  it('renders a GFM table with alignment', () => {
    const html = renderMarkdown('| A | B |\n|:--|--:|\n| 1 | 2 |\n')

    expect(html).toContain('<table>')
    expect(html).toContain('<th align="left">A</th>')
    expect(html).toContain('<td align="right">2</td>')
  })

  it('renders GFM strikethrough and task lists', () => {
    const html = renderMarkdown('~~gone~~\n\n- [x] done\n- [ ] todo\n')

    expect(html).toContain('<del>gone</del>')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('checked')
  })

  it('renders fenced code with a language class', () => {
    const html = renderMarkdown('```ts\nconst a = 1 < 2\n```\n')

    expect(html).toContain('<pre><code class="language-ts">')
    expect(html).toContain('const a = 1 &lt; 2')
  })

  it('returns an empty string for blank input', () => {
    expect(renderMarkdown('')).toBe('')
    expect(renderMarkdown('  \n ')).toBe('')
  })

  describe('xSS vectors', () => {
    it('removes a raw script element', () => {
      const html = renderMarkdown('Hi\n\n<script>alert(1)</script>\n\nafter')

      expect(html).not.toContain('<script')
      expect(html).not.toContain('alert(1)')
      expect(html).toContain('after')
    })

    it('removes an img with onerror', () => {
      const html = renderMarkdown('<img src=x onerror=alert(1)>')

      expect(html).not.toContain('onerror')
      expect(html).not.toContain('<img')
    })

    it('removes raw HTML, inline and as a block', () => {
      const html = renderMarkdown('a <b onclick="x()">bold</b> b\n\n<div style="color:red">block</div>\n\n<iframe src="https://evil.example"></iframe>')

      expect(html).not.toContain('onclick')
      expect(html).not.toContain('style')
      expect(html).not.toContain('<div')
      expect(html).not.toContain('iframe')
    })

    it('drops the href of a javascript: link', () => {
      const html = renderMarkdown('[x](javascript:alert(1))')

      expect(html).not.toContain('javascript:')
      expect(html).not.toContain('href')
      expect(html).toContain('x')
    })

    it('drops an obfuscated javascript: link', () => {
      const html = renderMarkdown('[x](java&#115;cript:alert(1))\n\n[y](JaVaScRiPt:alert(1))')

      expect(html.toLowerCase()).not.toContain('javascript:')
      expect(html).not.toContain('href')
    })

    it('drops a javascript: autolink and a reference link', () => {
      const html = renderMarkdown('<javascript:alert(1)>\n\n[r]\n\n[r]: javascript:alert(1)')

      // The text may stay as plain link text. There is no href.
      expect(html).not.toContain('href')
    })

    it('drops a javascript: image src', () => {
      const html = renderMarkdown('![x](javascript:alert(1))')

      expect(html).not.toContain('javascript:')
      expect(html).not.toContain('src')
    })

    it('drops a data: link and a data:text/html image', () => {
      const html = renderMarkdown('[x](data:text/html,<script>alert(1)</script>)\n\n![y](data:text/html;base64,aaaa)')

      expect(html).not.toContain('data:')
    })

    it('drops an SVG data URL but keeps a PNG data URL', () => {
      const svg = renderMarkdown('![x](data:image/svg+xml,%3Csvg%20onload=alert(1)%3E)')
      const png = renderMarkdown('![x](data:image/png;base64,aaaa)')

      expect(svg).not.toContain('data:')
      expect(png).toContain('src="data:image/png;base64,aaaa"')
    })

    it('does not let a title break out of its attribute', () => {
      const html = renderMarkdown('[x](https://a.example "t\\" onmouseover=\\"alert(1)")')

      expect(html).not.toContain('" onmouseover=')
    })

    it('keeps http, https, mailto and relative links', () => {
      const html = renderMarkdown('[a](https://a.example) [b](http://b.example) [c](mailto:a@b.c) [d](/post/x) [e](#top)')

      expect(html).toContain('href="https://a.example"')
      expect(html).toContain('href="http://b.example"')
      expect(html).toContain('href="mailto:a@b.c"')
      expect(html).toContain('href="/post/x"')
      expect(html).toContain('href="#top"')
    })
  })
})

describe('markdownToPlainText', () => {
  it('strips the markup and separates blocks', () => {
    const text = markdownToPlainText('# Title\n\nSome **bold** text with a [link](https://a.example).\n\n- one\n- two\n')

    expect(text).toBe('Title Some bold text with a link. one two')
  })

  it('decodes entities and drops raw HTML', () => {
    const text = markdownToPlainText('Fish &amp; chips <script>alert(1)</script> 1 < 2')

    expect(text).toContain('Fish & chips')
    expect(text).not.toContain('<script')
    expect(text).toContain('1 < 2')
  })

  it('cuts a long text at a word edge, with an ellipsis, within maxLength', () => {
    const text = markdownToPlainText('word '.repeat(100), 50)

    expect(text.length).toBeLessThanOrEqual(50)
    expect(text.endsWith('…')).toBe(true)
    expect(text).not.toMatch(/wor…$/)
  })

  it('keeps a short text as it is', () => {
    expect(markdownToPlainText('Short *text*', 200)).toBe('Short text')
  })

  it('returns an empty string for blank input', () => {
    expect(markdownToPlainText('', 200)).toBe('')
    expect(markdownToPlainText('text', 0)).toBe('')
  })
})

describe('stripMdc', () => {
  const page = [
    '::pluto-hero',
    '#headline',
    'Small core. Big heart.',
    '',
    '#title',
    'A small CMS with a [biiiig heart]{.text-primary}.',
    '',
    '#links',
    '  :::u-button',
    '  ---',
    '  to: /getting-started',
    '  size: xl',
    '  ---',
    '  Get started',
    '  :::',
    '::',
    '',
    'Read the [docs](/docs){target=_blank} and :icon{name="i-lucide-heart"} more.',
    '',
    '```md',
    '::note',
    '#title',
    '::',
    '```',
  ].join('\n')

  it('keeps the text and drops the component markers, props, slots and attributes', () => {
    const text = stripMdc(page)

    expect(text).toContain('Small core. Big heart.')
    expect(text).toContain('A small CMS with a biiiig heart.')
    expect(text).toContain('Get started')
    expect(text).toContain('Read the [docs](/docs) and  more.')
    expect(text).not.toMatch(/^\s*::pluto-hero/m)
    expect(text).not.toContain('#headline')
    expect(text).not.toContain('to: /getting-started')
    expect(text).not.toContain('{.text-primary}')
  })

  it('keeps fenced code as it is', () => {
    expect(stripMdc(page)).toContain('```md\n::note\n#title\n::\n```')
  })

  it('keeps a heading, a rule and plain Markdown', () => {
    const plain = '# Title\n\nText.\n\n---\n\n## Next\n\n#hashtag text'

    expect(stripMdc(plain)).toBe(plain)
  })

  it('gives clean html and a clean excerpt for an MDC page', () => {
    expect(renderMarkdown('::note\nSave your work.\n::')).toBe('<p>Save your work.</p>\n')
    expect(markdownToPlainText(page, 200)).toBe('Small core. Big heart. A small CMS with a biiiig heart. Get started Read the docs and more. ::note #title ::')
  })
})
