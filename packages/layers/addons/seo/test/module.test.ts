import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import seoModule from '../modules/pluto-seo'
import {
  PLUTO_SEO_ROUTES,
  plutoSeoRoutesToAdd,
  plutoSeoStaticWarning,
} from '../modules/pluto-seo/routes'

const added: Record<string, unknown>[] = []
const warnings: string[] = []

vi.mock('@nuxt/kit', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  addServerHandler: (handler: Record<string, unknown>) => added.push(handler),
  useLogger: () => ({ warn: (message: string) => warnings.push(message) }),
}))

let root: string

beforeEach(() => {
  added.length = 0
  warnings.length = 0
  root = mkdtempSync(join(tmpdir(), 'pluto-seo-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  vi.unstubAllEnvs()
})

async function run(
  options: { static?: boolean; websiteUrl?: string; layers?: string[] } = {}
) {
  const hooks: Record<string, (config: any) => void> = {}
  const nuxt = {
    options: {
      _layers: (options.layers ?? [root]).map((rootDir) => ({
        config: { rootDir },
      })),
      runtimeConfig: {
        public: {
          websiteUrl: options.websiteUrl ?? '',
          plutoPublicApi: { static: options.static === true },
        },
      },
    },
    hook: (name: string, callback: (config: any) => void) => {
      hooks[name] = callback
    },
  } as any
  await (seoModule as any)({}, nuxt)
  const nitro: any = { prerender: { routes: ['/api/pluto/v1/index.json'] } }
  hooks['nitro:config']?.(nitro)
  return nitro
}

describe('the seo module', () => {
  it('adds the three routes', async () => {
    await run()
    expect(added.map((handler) => [handler.route, handler.method])).toEqual([
      ['/sitemap.xml', 'get'],
      ['/robots.txt', 'get'],
      ['/feed.xml', 'get'],
    ])
    for (const handler of added) {
      expect(String(handler.handler).replaceAll('\\', '/')).toMatch(
        /server\/handlers\/(sitemap|robots|feed)\.get$/
      )
    }
  })

  it('skips a route when public/ has the file', async () => {
    mkdirSync(join(root, 'public'))
    writeFileSync(join(root, 'public', 'robots.txt'), 'User-agent: *\n')
    await run()
    expect(added.map((handler) => handler.route)).toEqual([
      '/sitemap.xml',
      '/feed.xml',
    ])
  })

  it('looks in the public/ folder of every layer', async () => {
    const layer = mkdtempSync(join(tmpdir(), 'pluto-seo-layer-'))
    try {
      mkdirSync(join(layer, 'public'))
      writeFileSync(join(layer, 'public', 'sitemap.xml'), '<urlset />')
      await run({ layers: [root, layer] })
      expect(added.map((handler) => handler.route)).toEqual([
        '/robots.txt',
        '/feed.xml',
      ])
    } finally {
      rmSync(layer, { recursive: true, force: true })
    }
  })

  it('prerenders the routes in a static build, after the routes that are there', async () => {
    const nitro = await run({ static: true, websiteUrl: 'https://a.io' })
    expect(nitro.prerender.routes).toEqual([
      '/api/pluto/v1/index.json',
      '/sitemap.xml',
      '/robots.txt',
      '/feed.xml',
    ])
    expect(warnings).toEqual([])
  })

  it('does not prerender a route that public/ replaces', async () => {
    mkdirSync(join(root, 'public'))
    writeFileSync(join(root, 'public', 'feed.xml'), '<rss />')
    const nitro = await run({ static: true, websiteUrl: 'https://a.io' })
    expect(nitro.prerender.routes).not.toContain('/feed.xml')
  })

  it('adds nothing to the prerender in a server build', async () => {
    const nitro = await run()
    expect(nitro.prerender.routes).toEqual(['/api/pluto/v1/index.json'])
  })

  it('warns in a static build with no site URL', async () => {
    await run({ static: true })
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('NUXT_PUBLIC_WEBSITE_URL')
  })

  it('takes the site URL of the environment too', async () => {
    vi.stubEnv('NUXT_PUBLIC_WEBSITE_URL', 'https://a.io')
    await run({ static: true })
    expect(warnings).toEqual([])
  })
})

describe('plutoSeoRoutesToAdd', () => {
  it('gives every route when no file is there', () => {
    expect(plutoSeoRoutesToAdd(() => false)).toEqual(PLUTO_SEO_ROUTES)
  })

  it('asks for the name without the slash', () => {
    const asked: string[] = []
    plutoSeoRoutesToAdd((name) => {
      asked.push(name)
      return false
    })
    expect(asked).toEqual(['sitemap.xml', 'robots.txt', 'feed.xml'])
  })
})

describe('plutoSeoStaticWarning', () => {
  it('warns for a static build without a site URL', () => {
    expect(plutoSeoStaticWarning({ staticBuild: true })).toContain(
      'NUXT_PUBLIC_WEBSITE_URL'
    )
    expect(
      plutoSeoStaticWarning({ staticBuild: true, websiteUrl: '  ' })
    ).toBeDefined()
  })

  it('is silent with a site URL, and for a server build', () => {
    expect(
      plutoSeoStaticWarning({ staticBuild: true, websiteUrl: 'https://a.io' })
    ).toBeUndefined()
    expect(plutoSeoStaticWarning({ staticBuild: false })).toBeUndefined()
  })
})
