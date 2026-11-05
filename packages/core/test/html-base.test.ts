import { describe, expect, it } from 'vitest'
import { withBaseInHtml, withBasePath } from '../shared/utils/html-base'

describe('withBaseInHtml', () => {
  const html =
    '<p><img src="/media/a.png" alt="A"> <a href="/posts/b">B</a> <a href="/">Home</a></p>'

  it('puts the base before each site path', () => {
    expect(withBaseInHtml(html, '/repo/')).toBe(
      '<p><img src="/repo/media/a.png" alt="A"> <a href="/repo/posts/b">B</a> <a href="/repo/">Home</a></p>'
    )
  })

  it('accepts a base with no trailing slash', () => {
    expect(withBaseInHtml('<a href="/x">x</a>', '/repo')).toBe(
      '<a href="/repo/x">x</a>'
    )
  })

  it('changes nothing with the root base', () => {
    expect(withBaseInHtml(html, '/')).toBe(html)
    expect(withBaseInHtml(html, '')).toBe(html)
  })

  it('keeps full URLs, protocol-relative URLs, relative paths and anchors', () => {
    const other =
      '<a href="https://example.com/x">a</a><img src="//cdn.test/a.png"><a href="b">b</a><a href="#c">c</a><a href="?d=1">d</a>'
    expect(withBaseInHtml(other, '/repo/')).toBe(other)
  })

  it('keeps a path that already has the base', () => {
    const done = '<a href="/repo/posts/b">b</a>'
    expect(withBaseInHtml(done, '/repo/')).toBe(done)
  })

  it('reads only attributes, not the text', () => {
    const text = '<p>src="/media/a.png"</p><code>href="/x"</code>'
    expect(withBaseInHtml(text, '/repo/')).toBe(text)
  })
})

describe('withBasePath', () => {
  it('puts the base before a site path, once', () => {
    expect(withBasePath('/media/a.png', '/repo/')).toBe('/repo/media/a.png')
    expect(withBasePath('/media/a.png', '/repo')).toBe('/repo/media/a.png')
    expect(withBasePath('/repo/media/a.png', '/repo/')).toBe(
      '/repo/media/a.png'
    )
  })

  it('keeps the path with the root base, and keeps other URLs', () => {
    expect(withBasePath('/media/a.png', '/')).toBe('/media/a.png')
    expect(withBasePath('https://cdn.test/a.png', '/repo/')).toBe(
      'https://cdn.test/a.png'
    )
    expect(withBasePath('//cdn.test/a.png', '/repo/')).toBe('//cdn.test/a.png')
    expect(withBasePath('a.png', '/repo/')).toBe('a.png')
  })
})
