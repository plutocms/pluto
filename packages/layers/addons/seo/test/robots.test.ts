import { afterEach, describe, expect, it, vi } from 'vitest'
import { setupSeoServer } from './helpers/server'

vi.mock('../../../../core/server/utils/pluto-api-config', () => ({
  getPlutoApiConfig: () => ({ cors: true, maxAge: 60 }),
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

async function robots(options: Parameters<typeof setupSeoServer>[0] = {}) {
  const server = setupSeoServer(options)
  const handler = (await import('../server/handlers/robots.get')).default as (
    event: unknown
  ) => string
  const event = server.event()
  return { body: handler(event), event }
}

describe('robots.txt', () => {
  it('disallows the admin and names the sitemap', async () => {
    const { body, event } = await robots()
    expect(body).toBe(
      [
        'User-agent: *',
        'Disallow: /admin',
        'Disallow: /api/_pluto',
        'Disallow: /_pluto',
        '',
        'Sitemap: https://example.com/sitemap.xml',
        '',
      ].join('\n')
    )
    expect(event.headers['Content-Type']).toBe('text/plain; charset=utf-8')
  })

  it('adds the paths of the settings', async () => {
    const { body } = await robots({
      config: { robots: { disallow: ['/drafts/', 'private'] } },
    })
    expect(body).toContain('Disallow: /drafts/\n')
    expect(body).toContain('Disallow: /private\n')
  })

  it('puts the base path in front of each path', async () => {
    const { body } = await robots({
      baseURL: '/repo/',
      root: 'https://a.io/repo',
    })
    expect(body).toContain('Disallow: /repo/admin\n')
    expect(body).toContain('Sitemap: https://a.io/repo/sitemap.xml')
  })

  it('has no Sitemap line when the site URL is not known', async () => {
    const { body } = await robots({ root: null })
    expect(body).not.toContain('Sitemap')
    expect(body).toContain('Disallow: /admin')
  })

  it('disallows the whole site when it is not indexable', async () => {
    const { body } = await robots({ config: { indexable: false } })
    expect(body).toBe('User-agent: *\nDisallow: /\n')
  })
})
