import { afterEach, describe, expect, it, vi } from 'vitest'
import { postFile, setupSeoServer } from './helpers/server'

vi.mock('../../../../core/server/utils/pluto-api-config', () => ({
  getPlutoApiConfig: () => ({ cors: true, maxAge: 60 }),
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

function files(count = 3) {
  const out: Record<string, string> = {
    'content/posts/draft.md': postFile({ title: 'Draft', status: 'draft' }),
    'content/posts/hidden.md': postFile({
      title: 'Hidden',
      status: 'published',
      publishedAt: '2026-04-01T10:00:00.000Z',
      seo: '{ noindex: true }',
    }),
  }
  for (let index = 1; index <= count; index++) {
    const day = String((index % 28) + 1).padStart(2, '0')
    out[`content/posts/post-${index}.md`] = postFile({
      title: `Post ${index} & more`,
      status: 'published',
      publishedAt: `2026-03-${day}T10:00:00.000Z`,
      updatedAt: `2026-03-${day}T12:00:00.000Z`,
      excerpt: `Excerpt <b>${index}</b>`,
    })
  }
  return out
}

function feedConfig(extra: Record<string, unknown> = {}) {
  return {
    feed: {
      type: 'post',
      title: '',
      description: '',
      language: '',
      limit: 20,
      ...extra,
    },
  }
}

async function feed(options: Parameters<typeof setupSeoServer>[0] = {}) {
  const server = setupSeoServer({ files: files(), ...options })
  const handler = (await import('../server/handlers/feed.get')).default as (
    event: unknown
  ) => Promise<string>
  const event = server.event()
  return { body: await handler(event), event }
}

describe('feed.xml', () => {
  it('is an RSS 2.0 channel with the newest posts first', async () => {
    const { body, event } = await feed({
      runtime: { websiteName: 'My Blog', websiteDescription: 'About me' },
    })
    expect(body).toContain(
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">'
    )
    expect(body).toContain('<title>My Blog</title>')
    expect(body).toContain('<description>About me</description>')
    expect(body).toContain(
      '<atom:link href="https://example.com/feed.xml" rel="self" type="application/rss+xml" />'
    )
    const links = [...body.matchAll(/<link>(.*?)<\/link>/g)].map(
      (match) => match[1]
    )
    expect(links).toEqual([
      'https://example.com/',
      'https://example.com/posts/post-3',
      'https://example.com/posts/post-2',
      'https://example.com/posts/post-1',
    ])
    expect(event.headers['Content-Type']).toBe('application/xml; charset=utf-8')
  })

  it('gives each item a title, a permalink guid, a date and the excerpt as the description', async () => {
    const { body } = await feed()
    expect(body).toContain('<title>Post 3 &amp; more</title>')
    expect(body).toContain(
      '<guid isPermaLink="true">https://example.com/posts/post-3</guid>'
    )
    expect(body).toContain('<pubDate>Wed, 04 Mar 2026 10:00:00 GMT</pubDate>')
    expect(body).toContain(
      '<description>Excerpt &lt;b&gt;3&lt;/b&gt;</description>'
    )
    expect(body).toContain(
      '<lastBuildDate>Wed, 04 Mar 2026 12:00:00 GMT</lastBuildDate>'
    )
  })

  it('leaves out a draft and a post that says noindex', async () => {
    const { body } = await feed()
    expect(body).not.toContain('Draft')
    expect(body).not.toContain('Hidden')
  })

  it('prefers the SEO description to the excerpt', async () => {
    const { body } = await feed({
      files: {
        'content/posts/a.md': postFile({
          title: 'A',
          status: 'published',
          publishedAt: '2026-03-01T10:00:00.000Z',
          excerpt: 'The excerpt',
          seo: '{ description: The SEO text }',
        }),
      },
    })
    expect(body).toContain('<description>The SEO text</description>')
  })

  it('keeps the newest items up to the limit of the settings', async () => {
    const { body } = await feed({
      config: feedConfig({ title: 'T', language: 'pt-BR', limit: 2 }),
    })
    expect(body.match(/<item>/g)).toHaveLength(2)
    expect(body).toContain('post-3')
    expect(body).not.toContain('post-1')
    expect(body).toContain('<language>pt-BR</language>')
  })

  it('caps the limit at 100, and uses 20 for a limit that is not a number', async () => {
    const big = await feed({
      files: files(120),
      config: feedConfig({ limit: 500 }),
    })
    expect(big.body.match(/<item>/g)).toHaveLength(100)
    vi.unstubAllGlobals()
    const none = await feed({
      files: files(30),
      config: feedConfig({ limit: 'many' }),
    })
    expect(none.body.match(/<item>/g)).toHaveLength(20)
  })

  it('is a valid empty channel for a type that is missing', async () => {
    const { body } = await feed({
      config: feedConfig({ type: 'nothing', title: 'Empty' }),
    })
    expect(body).toContain('<title>Empty</title>')
    expect(body).not.toContain('<item>')
  })

  it('is a valid empty channel when the site URL is not known', async () => {
    const { body } = await feed({ root: null })
    expect(body).toContain('<channel>')
    expect(body).not.toContain('<item>')
    expect(body).not.toContain('atom:link')
  })

  it('names the channel Feed when nothing gives a title', async () => {
    const { body } = await feed({ runtime: { websiteName: 'Untitled' } })
    expect(body).toContain('<title>Feed</title>')
  })
})
