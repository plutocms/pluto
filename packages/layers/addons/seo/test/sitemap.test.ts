import { afterEach, describe, expect, it, vi } from 'vitest'
import { postFile, setupSeoServer } from './helpers/server'

vi.mock('../../../../core/server/utils/pluto-api-config', () => ({
  getPlutoApiConfig: () => ({ cors: true, maxAge: 60 }),
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

const FILES = {
  'content/posts/new.md': postFile({
    title: 'New',
    status: 'published',
    publishedAt: '2026-03-02T10:00:00.000Z',
    updatedAt: '2026-03-04T10:00:00.000Z',
  }),
  'content/posts/old.md': postFile({
    title: 'Old',
    status: 'published',
    publishedAt: '2026-01-02T10:00:00.000Z',
  }),
  'content/posts/draft.md': postFile({ title: 'Draft', status: 'draft' }),
  'content/posts/hidden.md': postFile({
    title: 'Hidden',
    status: 'published',
    publishedAt: '2026-02-02T10:00:00.000Z',
    seo: '{ noindex: true }',
  }),
}

async function sitemap(options: Parameters<typeof setupSeoServer>[0] = {}) {
  const server = setupSeoServer({ files: FILES, ...options })
  const handler = (await import('../server/handlers/sitemap.get')).default as (
    event: unknown
  ) => Promise<string>
  const event = server.event()
  return { body: await handler(event), event }
}

const locsOf = (body: string) =>
  [...body.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1])

describe('sitemap.xml', () => {
  it('lists the paths, then the published posts, with the date of the last change', async () => {
    const { body } = await sitemap()
    expect(body).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    )
    const locs = locsOf(body)
    expect(locs[0]).toBe('https://example.com/')
    expect(new Set(locs)).toEqual(
      new Set([
        'https://example.com/',
        'https://example.com/posts/new',
        'https://example.com/posts/old',
      ])
    )
    // updatedAt wins, then publishedAt.
    expect(body).toContain(
      '<loc>https://example.com/posts/new</loc>\n    <lastmod>2026-03-04T10:00:00.000Z</lastmod>'
    )
    expect(body).toContain(
      '<loc>https://example.com/posts/old</loc>\n    <lastmod>2026-01-02T10:00:00.000Z</lastmod>'
    )
  })

  it('leaves out a draft and a post that says noindex', async () => {
    const { body } = await sitemap()
    expect(body).not.toContain('/posts/draft')
    expect(body).not.toContain('/posts/hidden')
  })

  it('answers as XML with the public cache header', async () => {
    const { event } = await sitemap()
    expect(event.headers['Content-Type']).toBe('application/xml; charset=utf-8')
    expect(event.headers['Cache-Control']).toContain('public')
  })

  it('puts the base path of a project site in each URL', async () => {
    const { body } = await sitemap({ root: 'https://a.io/repo' })
    expect(body).toContain('<loc>https://a.io/repo/</loc>')
    expect(body).toContain('<loc>https://a.io/repo/posts/new</loc>')
  })

  it('adds the paths of the settings, and does not repeat a URL', async () => {
    const { body } = await sitemap({
      config: {
        sitemap: {
          paths: ['/', '/about', '/about', '/posts/new'],
          exclude: {},
        },
      },
    })
    const locs = locsOf(body)
    expect(
      locs.filter((loc) => loc === 'https://example.com/about')
    ).toHaveLength(1)
    expect(
      locs.filter((loc) => loc === 'https://example.com/posts/new')
    ).toHaveLength(1)
    // The path came first, so the post only adds its date.
    expect(body).toContain(
      '<loc>https://example.com/posts/new</loc>\n    <lastmod>2026-03-04T10:00:00.000Z</lastmod>'
    )
  })

  it('leaves out a content type that the settings exclude', async () => {
    const { body } = await sitemap({
      config: { sitemap: { paths: ['/'], exclude: { post: true } } },
    })
    expect(body).not.toContain('/posts/')
    expect(body).toContain('<loc>https://example.com/</loc>')
  })

  it('is an empty urlset when the site URL is not known', async () => {
    const { body } = await sitemap({ root: null })
    expect(body).toContain('<urlset')
    expect(body).not.toContain('<url>')
  })
})
