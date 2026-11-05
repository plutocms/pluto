import { describe, expect, it } from 'vitest'
import {
  plutoSeoCanonicalPath,
  plutoSeoDescription,
  plutoSeoIsPrivatePath,
  plutoSeoItemHead,
  plutoSeoPlainText,
  plutoSeoSiteHead,
} from '../shared/utils/seo-head'

const absoluteUrl = (path: string) =>
  /^https?:\/\//.test(path)
    ? path
    : `https://a.io/repo/${path.replace(/^\/+/, '')}`

const type: any = {
  name: 'post',
  titleField: 'title',
  fields: [
    { name: 'title', type: 'text' },
    { name: 'cover', type: 'media' },
    { name: 'gallery', type: 'media', multiple: true },
    { name: 'seoImage', type: 'media' },
  ],
}

const image = (name: string, extra: Record<string, unknown> = {}) => ({
  id: name,
  url: `/media/${name}.webp`,
  ...extra,
})

describe('plutoSeoPlainText', () => {
  it('strips tags, decodes entities and collapses white space', () => {
    expect(
      plutoSeoPlainText('<h1>Hello</h1>\n<p>A &amp; B &lt;ok&gt;&nbsp;now</p>')
    ).toBe('Hello A & B <ok> now')
  })

  it('drops script and style content', () => {
    expect(
      plutoSeoPlainText(
        '<style>p{color:red}</style><p>Text</p><script>x()</script>'
      )
    ).toBe('Text')
  })

  it('cuts a long text at a word end, with an ellipsis', () => {
    const text = plutoSeoPlainText(`<p>${'word '.repeat(60)}</p>`, 160)
    expect(text.length).toBeLessThanOrEqual(160)
    expect(text.endsWith('word…')).toBe(true)
  })

  it('leaves a short text alone', () => {
    expect(plutoSeoPlainText('<p>Short.</p>', 160)).toBe('Short.')
  })
})

describe('plutoSeoDescription', () => {
  it('takes seoDescription, then excerpt, then description, then the html', () => {
    expect(
      plutoSeoDescription({
        seoDescription: ' A ',
        excerpt: 'B',
        description: 'C',
        html: '<p>D</p>',
      })
    ).toBe('A')
    expect(
      plutoSeoDescription({ excerpt: 'B', description: 'C', html: '<p>D</p>' })
    ).toBe('B')
    expect(plutoSeoDescription({ description: 'C', html: '<p>D</p>' })).toBe(
      'C'
    )
    expect(plutoSeoDescription({ html: '<p>D</p>' })).toBe('D')
  })

  it('skips an empty value, and gives undefined when there is nothing', () => {
    expect(plutoSeoDescription({ seoDescription: '  ', excerpt: 'B' })).toBe(
      'B'
    )
    expect(plutoSeoDescription({ html: '' })).toBeUndefined()
    expect(plutoSeoDescription(null)).toBeUndefined()
  })

  it('cuts the text of the html at 160', () => {
    const text = plutoSeoDescription({
      html: `<p>${'sentence '.repeat(40)}</p>`,
    })!
    expect(text.length).toBeLessThanOrEqual(160)
  })
})

describe('plutoSeoItemHead', () => {
  it('prefers the SEO title and the SEO image', () => {
    const head = plutoSeoItemHead(
      {
        title: 'Title',
        seoTitle: 'SEO title',
        cover: image('cover'),
        seoImage: image('social', { width: 1200, height: 630, alt: 'Alt' }),
      },
      { type, absoluteUrl }
    )
    expect(head.title).toBe('SEO title')
    expect(head.image).toEqual({
      url: 'https://a.io/repo/media/social.webp',
      alt: 'Alt',
      width: 1200,
      height: 630,
    })
  })

  it('falls back to the title field of the type', () => {
    const other = { ...type, titleField: 'name' }
    expect(
      plutoSeoItemHead({ name: 'The name' }, { type: other, absoluteUrl }).title
    ).toBe('The name')
    expect(plutoSeoItemHead({ title: 'T' }, { absoluteUrl }).title).toBe('T')
  })

  it('falls back to the cover, then the first media field with a file, then the default image', () => {
    expect(
      plutoSeoItemHead({ cover: image('cover') }, { type, absoluteUrl }).image
        ?.url
    ).toBe('https://a.io/repo/media/cover.webp')
    expect(
      plutoSeoItemHead(
        { gallery: [image('one'), image('two')] },
        { type, absoluteUrl }
      ).image?.url
    ).toBe('https://a.io/repo/media/one.webp')
    expect(
      plutoSeoItemHead(
        { cover: null },
        { type, absoluteUrl, defaultImage: '/og.png' }
      ).image
    ).toEqual({ url: 'https://a.io/repo/og.png' })
    expect(plutoSeoItemHead({ cover: null }, { type, absoluteUrl }).image).toBe(
      undefined
    )
  })

  it('gives no image when the site root is not known', () => {
    const none = (path: string) => (/^https?:\/\//.test(path) ? path : '')
    const head = plutoSeoItemHead(
      { cover: image('cover') },
      { type, absoluteUrl: none, defaultImage: '/og.png' }
    )
    expect(head.image).toBeUndefined()
  })

  it('keeps a full URL of an image as it is', () => {
    expect(
      plutoSeoItemHead(
        { cover: { url: 'https://cdn.io/x.png' } },
        { type, absoluteUrl }
      ).image
    ).toEqual({ url: 'https://cdn.io/x.png' })
  })

  it('reads noindex and the times', () => {
    const head = plutoSeoItemHead(
      {
        seoNoindex: true,
        publishedAt: '2026-03-01T00:00:00Z',
        updatedAt: '2026-03-02T00:00:00Z',
      },
      { type, absoluteUrl }
    )
    expect(head).toMatchObject({
      noindex: true,
      publishedTime: '2026-03-01T00:00:00Z',
      modifiedTime: '2026-03-02T00:00:00Z',
    })
    expect(
      plutoSeoItemHead({ seoNoindex: false }, { absoluteUrl }).noindex
    ).toBe(false)
  })

  it('gives an empty head while the item loads', () => {
    expect(plutoSeoItemHead(null, { type, absoluteUrl })).toEqual({
      noindex: false,
    })
  })
})

describe('plutoSeoCanonicalPath', () => {
  it('adds ?page=N only for a page above 1', () => {
    expect(plutoSeoCanonicalPath('/posts', '2')).toBe('/posts?page=2')
    expect(plutoSeoCanonicalPath('/posts', '1')).toBe('/posts')
    expect(plutoSeoCanonicalPath('/posts', undefined)).toBe('/posts')
    expect(plutoSeoCanonicalPath('/posts', ['3', '4'])).toBe('/posts?page=3')
  })

  it('ignores a page that is not a whole number', () => {
    expect(plutoSeoCanonicalPath('/posts', 'abc')).toBe('/posts')
    expect(plutoSeoCanonicalPath('/posts', '-2')).toBe('/posts')
    expect(plutoSeoCanonicalPath('/posts', '2.5')).toBe('/posts')
  })
})

describe('plutoSeoIsPrivatePath', () => {
  it('knows the admin, the preview pages and the API of the admin', () => {
    for (const path of [
      '/admin',
      '/admin/home',
      '/_pluto/post-preview',
      '/api/_pluto/x',
    ]) {
      expect(plutoSeoIsPrivatePath(path)).toBe(true)
    }
    for (const path of [
      '/',
      '/posts/admin',
      '/administration',
      '/api/pluto/v1/x',
    ]) {
      expect(plutoSeoIsPrivatePath(path)).toBe(false)
    }
  })
})

describe('plutoSeoSiteHead', () => {
  const config = {
    image: '',
    twitterSite: '',
    indexable: true,
    feed: { type: 'post', title: '', description: '', language: '', limit: 20 },
  }
  const base = { path: '/posts/a', config, absoluteUrl }

  it('sets the canonical URL, og:url and a summary card', () => {
    expect(plutoSeoSiteHead(base)).toEqual({
      link: [{ rel: 'canonical', href: 'https://a.io/repo/posts/a' }],
      meta: [
        { property: 'og:url', content: 'https://a.io/repo/posts/a' },
        { name: 'twitter:card', content: 'summary' },
      ],
    })
  })

  it('adds the page of a list to the canonical URL', () => {
    const head = plutoSeoSiteHead({ ...base, path: '/posts', page: '2' })
    expect(head.link[0]).toEqual({
      rel: 'canonical',
      href: 'https://a.io/repo/posts?page=2',
    })
  })

  it('has no canonical and no og:url when the site root is not known', () => {
    const head = plutoSeoSiteHead({
      ...base,
      absoluteUrl: (path) => (/^https?:\/\//.test(path) ? path : ''),
    })
    expect(head.link).toEqual([])
    expect(head.meta).toEqual([{ name: 'twitter:card', content: 'summary' }])
  })

  it('adds the site name, the default image and the Twitter handle', () => {
    const head = plutoSeoSiteHead({
      ...base,
      siteName: 'My Blog',
      config: { ...config, image: '/og.png', twitterSite: '@pluto' },
    })
    expect(head.meta).toEqual(
      expect.arrayContaining([
        { property: 'og:site_name', content: 'My Blog' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:site', content: '@pluto' },
        { property: 'og:image', content: 'https://a.io/repo/og.png' },
        { name: 'twitter:image', content: 'https://a.io/repo/og.png' },
      ])
    )
  })

  it('links the feed when the feed type is public', () => {
    const head = plutoSeoSiteHead({ ...base, hasFeed: true, siteName: 'Blog' })
    expect(head.link).toContainEqual({
      rel: 'alternate',
      type: 'application/rss+xml',
      title: 'Blog',
      href: 'https://a.io/repo/feed.xml',
    })
    expect(plutoSeoSiteHead(base).link).toHaveLength(1)
  })

  it('links the feed with the base path when the site root is not known', () => {
    const head = plutoSeoSiteHead({
      ...base,
      hasFeed: true,
      baseURL: '/repo/',
      absoluteUrl: (path) => (/^https?:\/\//.test(path) ? path : ''),
    })
    expect(head.link).toEqual([
      {
        rel: 'alternate',
        type: 'application/rss+xml',
        title: 'RSS',
        href: '/repo/feed.xml',
      },
    ])
  })

  it('says noindex on every page of a site that is not indexable', () => {
    const head = plutoSeoSiteHead({
      ...base,
      config: { ...config, indexable: false },
    })
    expect(head.meta).toContainEqual({
      name: 'robots',
      content: 'noindex, nofollow',
    })
  })

  it('adds nothing to the admin, the preview pages and the error page', () => {
    const none = { link: [], meta: [] }
    expect(plutoSeoSiteHead({ ...base, path: '/admin/home' })).toEqual(none)
    expect(plutoSeoSiteHead({ ...base, path: '/_pluto/post-preview' })).toEqual(
      none
    )
    expect(plutoSeoSiteHead({ ...base, error: true })).toEqual(none)
  })
})
