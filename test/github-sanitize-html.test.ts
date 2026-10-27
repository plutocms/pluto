import { describe, expect, it } from 'vitest'
import { isSafeUrl, sanitizeHtml } from '../modules/pluto-github/runtime/server/utils/sanitize-html'

describe('sanitizeHtml', () => {
  it('drops a script element and its body', () => {
    const html = sanitizeHtml('<p>hi</p><script>alert(1)</script>')

    expect(html).not.toContain('script')
    expect(html).not.toContain('alert(1)')
    expect(html).toContain('<p>hi</p>')
  })

  it('drops onclick, onerror, and onload attributes', () => {
    const html = sanitizeHtml('<p onclick="evil()">a</p><img src="/a.png" onerror="evil()">')

    expect(html).not.toContain('onclick')
    expect(html).not.toContain('onerror')
  })

  it('drops the style attribute', () => {
    const html = sanitizeHtml('<p style="color:red">a</p>')

    expect(html).not.toContain('style')
  })

  it('unwraps div and span, keeping their text', () => {
    const html = sanitizeHtml('<div><span>kept text</span></div>')

    expect(html).not.toContain('<div')
    expect(html).not.toContain('<span')
    expect(html).toContain('kept text')
  })

  it('rejects a javascript: href but keeps the <a> element', () => {
    const html = sanitizeHtml('<a href="javascript:alert(1)">click</a>')

    expect(html).not.toContain('javascript:')
    expect(html).toContain('<a>click</a>')
  })

  it('rejects an entity-encoded javascript: href', () => {
    const html = sanitizeHtml('<a href="java&#115;cript:alert(1)">click</a>')

    expect(html).not.toContain('javascript:')
    expect(html.toLowerCase()).not.toContain('script:alert')
  })

  it('rejects a javascript: href hidden by an embedded tab', () => {
    const html = sanitizeHtml('<a href="java&#x09;script:alert(1)">click</a>')

    expect(html).not.toContain('href')
  })

  it('rejects a data:image/svg+xml src, keeps a data:image/png src', () => {
    const svg = sanitizeHtml('<img src="data:image/svg+xml,<svg onload=alert(1)>">')
    const png = sanitizeHtml('<img src="data:image/png;base64,aaaa">')

    expect(svg).not.toContain('data:image/svg')
    expect(png).toContain('data:image/png;base64,aaaa')
  })

  it('keeps relative, anchor, and mailto hrefs', () => {
    expect(sanitizeHtml('<a href="/post/x">a</a>')).toContain('href="/post/x"')
    expect(sanitizeHtml('<a href="#anchor">a</a>')).toContain('href="#anchor"')
    expect(sanitizeHtml('<a href="mailto:a@b.c">a</a>')).toContain('href="mailto:a@b.c"')
  })

  it('keeps a language- class on code, drops any other class', () => {
    const kept = sanitizeHtml('<code class="language-ts">x</code>')
    const dropped = sanitizeHtml('<code class="evil">x</code>')

    expect(kept).toContain('class="language-ts"')
    expect(dropped).not.toContain('class')
  })

  it('keeps a GFM table', () => {
    const html = sanitizeHtml(
      '<table><thead><tr><th align="left">A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>'
    )

    expect(html).toContain('<table>')
    expect(html).toContain('<th align="left">A</th>')
    expect(html).toContain('<td>1</td>')
  })

  it('keeps a task-list checkbox', () => {
    const html = sanitizeHtml('<li><input type="checkbox" checked disabled>done</li>')

    expect(html).toContain('type="checkbox"')
    expect(html).toContain('checked')
    expect(html).toContain('disabled')
  })

  it('drops iframe, object, and an svg with onload', () => {
    const html = sanitizeHtml(
      '<iframe src="https://evil.example"></iframe><object data="x"></object><svg onload="alert(1)"></svg>'
    )

    expect(html).not.toContain('iframe')
    expect(html).not.toContain('object')
    expect(html).not.toContain('svg')
    expect(html).not.toContain('onload')
  })

  it('escapes a quote inside a kept attribute value, so it cannot break out', () => {
    const html = sanitizeHtml('<img src="/a.png" alt=\'x" onerror="alert(1)\'>')

    // The quote is escaped, so "onerror" stays inert text inside `alt`
    // instead of starting a new, live attribute.
    expect(html).not.toContain('" onerror="')
    expect(html).toContain('&quot;')
  })
})

describe('isSafeUrl', () => {
  it('accepts relative paths, anchors, queries, and no-scheme values', () => {
    expect(isSafeUrl('/post/x')).toBe(true)
    expect(isSafeUrl('#anchor')).toBe(true)
    expect(isSafeUrl('?q=1')).toBe(true)
    expect(isSafeUrl('./file')).toBe(true)
    expect(isSafeUrl('plain-text')).toBe(true)
  })

  it('accepts http, https, and mailto', () => {
    expect(isSafeUrl('http://example.com')).toBe(true)
    expect(isSafeUrl('https://example.com')).toBe(true)
    expect(isSafeUrl('mailto:a@b.c')).toBe(true)
  })

  it('rejects javascript:, plain and obfuscated', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeUrl('java&#115;cript:alert(1)')).toBe(false)
    expect(isSafeUrl('java&#x09;script:alert(1)')).toBe(false)
  })

  it('accepts only the allowed data:image types', () => {
    expect(isSafeUrl('data:image/png;base64,aaaa')).toBe(true)
    expect(isSafeUrl('data:image/jpeg;base64,aaaa')).toBe(true)
    expect(isSafeUrl('data:image/gif;base64,aaaa')).toBe(true)
    expect(isSafeUrl('data:image/webp;base64,aaaa')).toBe(true)
    expect(isSafeUrl('data:image/avif;base64,aaaa')).toBe(true)
    expect(isSafeUrl('data:image/svg+xml,<svg></svg>')).toBe(false)
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
  })
})
