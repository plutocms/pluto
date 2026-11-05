import { describe, expect, it } from 'vitest'
import { absoluteSiteUrl, siteRootUrl } from '../shared/utils/url'

describe('siteRootUrl', () => {
  it('adds the base path when websiteUrl has none', () => {
    expect(
      siteRootUrl({ websiteUrl: 'https://user.github.io', baseURL: '/repo/' })
    ).toBe('https://user.github.io/repo')
  })

  it('keeps the base path that websiteUrl already has', () => {
    expect(
      siteRootUrl({
        websiteUrl: 'https://user.github.io/repo',
        baseURL: '/repo/',
      })
    ).toBe('https://user.github.io/repo')
    expect(
      siteRootUrl({
        websiteUrl: 'https://user.github.io/repo/',
        baseURL: '/repo/',
      })
    ).toBe('https://user.github.io/repo')
  })

  it('does not take a path that only ends like the base for the base', () => {
    expect(
      siteRootUrl({ websiteUrl: 'https://a.io/myrepo', baseURL: '/repo/' })
    ).toBe('https://a.io/myrepo/repo')
  })

  it('has no base path for a root site', () => {
    expect(siteRootUrl({ websiteUrl: 'https://a.io/', baseURL: '/' })).toBe(
      'https://a.io'
    )
    expect(siteRootUrl({ websiteUrl: 'https://a.io' })).toBe('https://a.io')
  })

  it('uses the origin without websiteUrl', () => {
    expect(
      siteRootUrl({ origin: 'http://localhost:3000', baseURL: '/repo/' })
    ).toBe('http://localhost:3000/repo')
    expect(
      siteRootUrl({
        websiteUrl: '',
        origin: 'http://localhost:3000',
        baseURL: '/',
      })
    ).toBe('http://localhost:3000')
  })

  it('gives an empty root when it is not known or not a web URL', () => {
    expect(siteRootUrl({ baseURL: '/repo/' })).toBe('')
    expect(siteRootUrl({ websiteUrl: 'example.com' })).toBe('')
    expect(siteRootUrl({ websiteUrl: 'ftp://example.com' })).toBe('')
  })
})

describe('absoluteSiteUrl', () => {
  it('keeps the base path of the root', () => {
    expect(absoluteSiteUrl('/posts/a', 'https://a.io/repo')).toBe(
      'https://a.io/repo/posts/a'
    )
    expect(absoluteSiteUrl('posts/a', 'https://a.io/repo/')).toBe(
      'https://a.io/repo/posts/a'
    )
    expect(absoluteSiteUrl('/', 'https://a.io/repo')).toBe('https://a.io/repo/')
  })

  it('works on a root with no base path', () => {
    expect(absoluteSiteUrl('/feed.xml', 'https://a.io')).toBe(
      'https://a.io/feed.xml'
    )
  })

  it('keeps a full URL', () => {
    expect(absoluteSiteUrl('https://cdn.io/a.png', 'https://a.io/repo')).toBe(
      'https://cdn.io/a.png'
    )
    expect(absoluteSiteUrl('http://cdn.io/a.png', '')).toBe(
      'http://cdn.io/a.png'
    )
  })

  it('gives //host the scheme of the root', () => {
    expect(absoluteSiteUrl('//cdn.io/a.png', 'https://a.io')).toBe(
      'https://cdn.io/a.png'
    )
    expect(absoluteSiteUrl('//cdn.io/a.png', 'http://localhost:3000')).toBe(
      'http://cdn.io/a.png'
    )
  })

  it('gives an empty text for a path when the root is not known', () => {
    expect(absoluteSiteUrl('/posts/a', '')).toBe('')
    expect(absoluteSiteUrl('/posts/a', null)).toBe('')
  })
})
