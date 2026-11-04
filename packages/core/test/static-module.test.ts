import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import staticModule, {
  isStaticPreset,
  normalizeBasePath,
  withBaseInHeadLinks,
} from '../modules/pluto-static'
import { kitCalls, resetKitCalls } from './fixtures/kit-mock'

vi.mock('@nuxt/kit', async (importOriginal) =>
  (await import('./fixtures/kit-mock')).kitMock(await importOriginal<object>())
)

async function run(extra: Record<string, unknown> = {}) {
  const nuxt = {
    options: {
      dev: false,
      _generate: true,
      app: { baseURL: '/' },
      nitro: {},
      runtimeConfig: { public: {} } as Record<string, any>,
      ...extra,
    },
    hook() {},
  } as any
  await staticModule({}, nuxt)
  return nuxt
}

beforeEach(() => {
  resetKitCalls()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('pluto-static module', () => {
  it('adds nothing to a server build or to dev', async () => {
    for (const extra of [{ _generate: false }, { dev: true }]) {
      const nuxt = await run(extra)
      expect(kitCalls.serverHandlers).toEqual([])
      expect(nuxt.options.runtimeConfig.public.plutoPublicApi).toBeUndefined()
      expect(nuxt.options.nitro.prerender).toBeUndefined()
    }
  })

  it('prerenders the public index and tells the client', async () => {
    const nuxt = await run()

    expect(kitCalls.serverHandlers).toEqual([
      expect.objectContaining({
        route: '/api/pluto/v1/index.json',
        method: 'get',
      }),
    ])
    expect(nuxt.options.nitro.prerender.routes).toEqual([
      '/api/pluto/v1/index.json',
    ])
    expect(nuxt.options.runtimeConfig.public.plutoPublicApi).toEqual({
      static: true,
    })
  })

  it('keeps the admin out of the prerender', async () => {
    const nuxt = await run()
    expect(nuxt.options.nitro.prerender.ignore).toEqual([
      '/admin',
      '/api/_pluto',
      '/_pluto',
    ])
  })

  it('knows a static Nitro preset', async () => {
    const nuxt = await run({
      _generate: false,
      nitro: { preset: 'github_pages' },
    })
    expect(nuxt.options.runtimeConfig.public.plutoPublicApi).toEqual({
      static: true,
    })
  })

  it('takes the base path from PLUTO_BASE_URL', async () => {
    vi.stubEnv('PLUTO_BASE_URL', 'my-site')
    const nuxt = await run()
    expect(nuxt.options.app.baseURL).toBe('/my-site/')
    expect(nuxt.options.runtimeConfig.app.baseURL).toBe('/my-site/')
  })

  it('puts the base path before the site links of app.head', async () => {
    vi.stubEnv('PLUTO_BASE_URL', '/templates/blog')
    const nuxt = await run({
      app: {
        baseURL: '/',
        head: {
          link: [
            { rel: 'icon', href: '/favicon.svg' },
            { rel: 'preconnect', href: 'https://fonts.example.com' },
          ],
        },
      },
    })
    expect(nuxt.options.app.head.link).toEqual([
      { rel: 'icon', href: '/templates/blog/favicon.svg' },
      { rel: 'preconnect', href: 'https://fonts.example.com' },
    ])
  })

  it('isStaticPreset, normalizeBasePath and withBaseInHeadLinks', () => {
    expect(isStaticPreset('github_pages')).toBe(true)
    expect(isStaticPreset('github-pages')).toBe(true)
    expect(isStaticPreset('static')).toBe(true)
    expect(isStaticPreset('netlify_static')).toBe(true)
    expect(isStaticPreset('vercel')).toBe(false)
    expect(isStaticPreset(undefined)).toBe(false)
    expect(normalizeBasePath('repo')).toBe('/repo/')
    expect(normalizeBasePath('/a/b/')).toBe('/a/b/')
    expect(normalizeBasePath('')).toBe('/')
    expect(
      withBaseInHeadLinks(
        [{ href: '/a.svg' }, { href: '//cdn.dev/b' }, { href: 'c.css' }, {}],
        '/repo/'
      )
    ).toEqual([
      { href: '/repo/a.svg' },
      { href: '//cdn.dev/b' },
      { href: 'c.css' },
      {},
    ])
  })
})
