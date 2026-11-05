import type { H3Event } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let config: {
  public: Record<string, unknown>
  app: { baseURL: string }
}

vi.mock('nitropack/runtime', () => ({
  useRuntimeConfig: () => config,
}))

const { getPlutoSiteRoot } = await import('../server/utils/pluto-site')

// h3 reads the URL from the request of the event.
function eventFor(host = 'blog.example.com'): H3Event {
  return {
    path: '/sitemap.xml',
    node: { req: { headers: { host }, url: '/sitemap.xml' } },
    req: { url: `http://${host}/sitemap.xml`, headers: new Headers({ host }) },
  } as unknown as H3Event
}

beforeEach(() => {
  config = { public: {}, app: { baseURL: '/' } }
})

describe('getPlutoSiteRoot', () => {
  it('uses websiteUrl and adds the base path', () => {
    config = {
      public: { websiteUrl: 'https://user.github.io' },
      app: { baseURL: '/repo/' },
    }

    expect(getPlutoSiteRoot(eventFor())).toBe('https://user.github.io/repo')
  })

  it('uses the origin of the request on a server build without websiteUrl', () => {
    config.app.baseURL = '/repo/'

    expect(getPlutoSiteRoot(eventFor())).toBe('http://blog.example.com/repo')
  })

  it('gives null on a static build without websiteUrl', () => {
    config.public = { plutoPublicApi: { static: true } }

    expect(getPlutoSiteRoot(eventFor())).toBeNull()
  })

  it('uses websiteUrl on a static build', () => {
    config.public = {
      websiteUrl: 'https://a.io',
      plutoPublicApi: { static: true },
    }

    expect(getPlutoSiteRoot(eventFor())).toBe('https://a.io')
  })
})
