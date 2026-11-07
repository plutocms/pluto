import { describe, expect, it } from 'vitest'
import {
  PLUTO_SEO_FEED_MAX,
  PLUTO_SEO_SITEMAP_MAX,
  plutoSeoEscapeXml,
  plutoSeoRenderRobots,
  plutoSeoRenderRss,
  plutoSeoRenderSitemap,
  plutoSeoRfc822,
} from '../shared/utils/seo-xml'

describe('plutoSeoEscapeXml', () => {
  it('escapes the five characters of XML', () => {
    expect(plutoSeoEscapeXml(`a & b < c > d "e" 'f'`)).toBe(
      'a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;'
    )
  })

  it('does not escape twice, and keeps other text', () => {
    expect(plutoSeoEscapeXml('Olá, mundo — 日本')).toBe('Olá, mundo — 日本')
    expect(plutoSeoEscapeXml('&amp;')).toBe('&amp;amp;')
  })

  it('drops the control characters that XML does not allow', () => {
    expect(plutoSeoEscapeXml('a\u0000b\u000Bc\u001Fd')).toBe('abcd')
    expect(plutoSeoEscapeXml('a\tb\nc\rd')).toBe('a\tb\nc\rd')
  })
})

describe('plutoSeoRfc822', () => {
  it('formats a date as RFC 822 in GMT', () => {
    expect(plutoSeoRfc822('2026-11-05T09:03:07.000Z')).toBe(
      'Thu, 05 Nov 2026 09:03:07 GMT'
    )
    expect(plutoSeoRfc822(new Date(Date.UTC(2026, 0, 1)))).toBe(
      'Thu, 01 Jan 2026 00:00:00 GMT'
    )
  })

  it('gives an empty text for a bad or missing date', () => {
    expect(plutoSeoRfc822('not a date')).toBe('')
    expect(plutoSeoRfc822(undefined)).toBe('')
    expect(plutoSeoRfc822(null)).toBe('')
  })
})

describe('plutoSeoRenderSitemap', () => {
  it('renders the urlset with the sitemap namespace', () => {
    const xml = plutoSeoRenderSitemap([
      { loc: 'https://a.io/' },
      { loc: 'https://a.io/posts/a?x=1&y=2', lastmod: '2026-03-04T10:00:00Z' },
    ])
    expect(xml).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '  <url>',
        '    <loc>https://a.io/</loc>',
        '  </url>',
        '  <url>',
        '    <loc>https://a.io/posts/a?x=1&amp;y=2</loc>',
        '    <lastmod>2026-03-04T10:00:00.000Z</lastmod>',
        '  </url>',
        '</urlset>',
        '',
      ].join('\n')
    )
  })

  it('leaves out a bad date', () => {
    expect(
      plutoSeoRenderSitemap([{ loc: 'https://a.io/', lastmod: 'soon' }])
    ).not.toContain('lastmod')
  })

  it('is an empty urlset for no URLs', () => {
    const xml = plutoSeoRenderSitemap([])
    expect(xml).toContain('<urlset')
    expect(xml).not.toContain('<url>')
  })

  it('keeps the first 50,000 URLs', () => {
    const urls = Array.from({ length: PLUTO_SEO_SITEMAP_MAX + 5 }, (_, i) => ({
      loc: `https://a.io/${i}`,
    }))
    const xml = plutoSeoRenderSitemap(urls)
    expect(xml.match(/<url>/g)).toHaveLength(PLUTO_SEO_SITEMAP_MAX)
    expect(xml).not.toContain(`https://a.io/${PLUTO_SEO_SITEMAP_MAX}<`)
  })
})

describe('plutoSeoRenderRss', () => {
  const channel = {
    title: 'My <Blog>',
    link: 'https://a.io/',
    description: 'About & more',
    language: 'pt-BR',
    selfLink: 'https://a.io/feed.xml',
    lastBuildDate: '2026-03-04T10:00:00Z',
  }

  it('renders an RSS 2.0 channel with the atom namespace', () => {
    const xml = plutoSeoRenderRss(channel, [
      {
        title: 'Post & co',
        link: 'https://a.io/posts/a',
        pubDate: '2026-03-02T10:00:00Z',
        description: 'The <b>text</b>',
      },
    ])
    expect(xml).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
        '  <channel>',
        '    <title>My &lt;Blog&gt;</title>',
        '    <link>https://a.io/</link>',
        '    <description>About &amp; more</description>',
        '    <language>pt-BR</language>',
        '    <atom:link href="https://a.io/feed.xml" rel="self" type="application/rss+xml" />',
        '    <lastBuildDate>Wed, 04 Mar 2026 10:00:00 GMT</lastBuildDate>',
        '    <item>',
        '      <title>Post &amp; co</title>',
        '      <link>https://a.io/posts/a</link>',
        '      <guid isPermaLink="true">https://a.io/posts/a</guid>',
        '      <pubDate>Mon, 02 Mar 2026 10:00:00 GMT</pubDate>',
        '      <description>The &lt;b&gt;text&lt;/b&gt;</description>',
        '    </item>',
        '  </channel>',
        '</rss>',
        '',
      ].join('\n')
    )
  })

  it('leaves out the optional parts that it has no value for', () => {
    const xml = plutoSeoRenderRss({ title: 'T', link: '', description: 'D' }, [
      { title: 'A', link: 'https://a.io/a', description: '' },
    ])
    expect(xml).not.toContain('language')
    expect(xml).not.toContain('atom:link')
    expect(xml).not.toContain('lastBuildDate')
    expect(xml).not.toContain('pubDate')
  })

  it('keeps the first 100 items', () => {
    const items = Array.from({ length: PLUTO_SEO_FEED_MAX + 3 }, (_, i) => ({
      title: `Item ${i}`,
      link: `https://a.io/${i}`,
      description: '',
    }))
    expect(plutoSeoRenderRss(channel, items).match(/<item>/g)).toHaveLength(
      PLUTO_SEO_FEED_MAX
    )
  })
})

describe('plutoSeoRenderRobots', () => {
  it('disallows the admin paths and names the sitemap', () => {
    expect(
      plutoSeoRenderRobots({
        indexable: true,
        disallow: [],
        sitemap: 'https://a.io/sitemap.xml',
      })
    ).toBe(
      'User-agent: *\nDisallow: /admin\nDisallow: /api/_pluto\nDisallow: /_pluto\n\nSitemap: https://a.io/sitemap.xml\n'
    )
  })

  it('adds paths, with or without a slash, once each', () => {
    const text = plutoSeoRenderRobots({
      indexable: true,
      disallow: ['/a/', 'b', '/admin', '  ', ''],
    })
    expect(text).toContain('Disallow: /a/\n')
    expect(text).toContain('Disallow: /b\n')
    expect(text.match(/Disallow: \/admin\n/g)).toHaveLength(1)
    expect(text.match(/Disallow:/g)).toHaveLength(5)
  })

  it('puts the base path in front of each path', () => {
    const text = plutoSeoRenderRobots({
      indexable: true,
      baseURL: '/repo/',
      disallow: ['/x'],
    })
    expect(text).toContain('Disallow: /repo/admin\n')
    expect(text).toContain('Disallow: /repo/x\n')
  })

  it('disallows the whole site when it is not indexable, with no sitemap', () => {
    expect(
      plutoSeoRenderRobots({
        indexable: false,
        disallow: ['/x'],
        sitemap: 'https://a.io/sitemap.xml',
      })
    ).toBe('User-agent: *\nDisallow: /\n')
  })
})

describe('dc:creator', () => {
  it('names the authors of an item', () => {
    const xml = plutoSeoRenderRss(
      { title: 'T', link: 'https://a.io/', description: 'D' },
      [
        {
          title: 'A',
          link: 'https://a.io/a',
          description: 'x',
          creator: 'Ana & Bo',
        },
        { title: 'B', link: 'https://a.io/b', description: 'y' },
      ]
    )
    expect(xml).toContain('      <dc:creator>Ana &amp; Bo</dc:creator>')
    expect(xml.match(/dc:creator>/g)).toHaveLength(2)
  })
})
