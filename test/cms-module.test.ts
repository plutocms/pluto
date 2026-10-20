import { beforeEach, describe, expect, it, vi } from 'vitest'
import cmsModule from '../modules/pluto-cms'
import { countKitCalls, kitCalls, resetKitCalls } from './fixtures/kit-mock'

vi.mock('@nuxt/kit', async (importOriginal) => (await import('./fixtures/kit-mock')).kitMock(await importOriginal<object>()))

const repo = { repo: 'acme/site' }

function stubNuxt(extra: Record<string, unknown> = {}) {
  return {
    options: {
      dev: false,
      _prepare: true,
      _layers: [],
      modules: [],
      rootDir: '/work/site',
      runtimeConfig: { public: {} } as Record<string, any>,
      ...extra,
    },
    hook() {},
  } as any
}

async function run(options: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const nuxt = stubNuxt(extra)
  await cmsModule(options, nuxt)
  return nuxt
}

function handler(route: string, method?: string) {
  return kitCalls.serverHandlers.find((entry) => entry.route === route && entry.method === method)
}

beforeEach(() => {
  resetKitCalls()
})

describe('pluto-cms module wiring', () => {
  it('adds nothing when disabled', async () => {
    const nuxt = await run({})

    expect(countKitCalls()).toBe(0)
    expect(nuxt.options.runtimeConfig).toEqual({ public: {} })
  })

  it('adds nothing when explicitly disabled', async () => {
    await run({ enabled: false, github: repo })

    expect(countKitCalls()).toBe(0)
  })

  it('adds nothing when it refuses to run with the supabase layer', async () => {
    await run({ enabled: true, github: repo }, { _layers: [{ config: { $meta: { name: 'supabase' } } }] })

    expect(countKitCalls()).toBe(0)
  })

  it('adds nothing when the options are bad', async () => {
    await run({ enabled: true, github: { repo: 'bad' } })

    expect(countKitCalls()).toBe(0)
  })

  it('adds the sign-in routes', async () => {
    await run({ enabled: true, github: repo })

    expect(handler('/api/_pluto/auth/github/login', 'get')?.handler).toMatch(/api[\\/]auth[\\/]github[\\/]login\.get$/)
    expect(handler('/api/_pluto/auth/github/callback', 'get')?.handler).toMatch(/api[\\/]auth[\\/]github[\\/]callback\.get$/)
    expect(handler('/api/_pluto/auth/logout', 'post')?.handler).toMatch(/api[\\/]auth[\\/]logout\.post$/)
    expect(handler('/api/_pluto/auth/session', 'get')?.handler).toMatch(/api[\\/]auth[\\/]session\.get$/)
  })

  it('adds the origin check as server middleware', async () => {
    await run({ enabled: true, github: repo })

    const middleware = kitCalls.serverHandlers.filter((entry) => entry.middleware === true)

    expect(middleware).toHaveLength(1)
    expect(middleware[0]!.handler).toMatch(/middleware[\\/]pluto-cms-origin$/)
  })

  it('adds the Nitro plugin, the client plugin and the route middleware', async () => {
    await run({ enabled: true, github: repo })

    expect(kitCalls.serverPlugins).toHaveLength(1)
    expect(kitCalls.serverPlugins[0]).toMatch(/server[\\/]plugins[\\/]pluto-cms$/)
    expect(kitCalls.plugins).toHaveLength(1)
    expect((kitCalls.plugins[0] as {
 src: string
}).src).toMatch(/app[\\/]plugins[\\/]pluto-cms$/)
    expect(kitCalls.routeMiddleware).toHaveLength(1)
    expect(kitCalls.routeMiddleware[0]).toMatchObject({ name: 'pluto-cms-auth', global: true })
    expect(kitCalls.importsDirs).toHaveLength(1)
    expect(kitCalls.importsDirs[0]).toMatch(/app[\\/]composables$/)
  })

  it('adds the login page under app/components/Pluto/Cms', async () => {
    await run({ enabled: true, github: repo })
    const pages: {
 name?: string
path: string
file?: string
}[] = [{ path: '/admin/home' }]

    expect(kitCalls.pageExtenders).toHaveLength(1)
    kitCalls.pageExtenders[0]!(pages)

    expect(pages).toHaveLength(2)
    expect(pages[1]).toMatchObject({ name: 'pluto-cms-login', path: '/admin/login' })
    expect(pages[1]!.file!.replaceAll('\\', '/')).toMatch(/\/app\/components\/Pluto\/Cms\/PlutoCmsLoginPage\.vue$/)
  })

  it('does not overwrite an existing /admin/login page', async () => {
    await run({ enabled: true, github: repo })
    const pages = [{ name: 'login', path: '/admin/login', file: '/app/pages/admin/login.vue' }]

    kitCalls.pageExtenders[0]!(pages)

    expect(pages).toEqual([{ name: 'login', path: '/admin/login', file: '/app/pages/admin/login.vue' }])
  })

  it('does not overwrite a nested /admin/login page', async () => {
    await run({ enabled: true, github: repo })
    const pages = [{ path: '/admin', children: [{ path: 'login' }] }]

    kitCalls.pageExtenders[0]!(pages as never)

    expect(pages).toEqual([{ path: '/admin', children: [{ path: 'login' }] }])
  })

  it('puts the server settings in the private runtime config, and no secret in the public one', async () => {
    const nuxt = await run({ enabled: true, github: { ...repo, apiUrl: 'https://ghe.example.com/api/v3' }, cache: { headTtl: 30 } })
    const { plutoCms } = nuxt.options.runtimeConfig

    expect(plutoCms).toMatchObject({
      apiUrl: 'https://ghe.example.com/api/v3',
      skipDeploy: true,
      headTtl: 30,
      cacheStorage: 'cache',
      postType: true,
      fsRoot: '',
      allowedUsers: '',
      githubReadToken: '',
    })
    expect(Object.keys(nuxt.options.runtimeConfig.public.plutoCms).sort()).toEqual(['appSlug', 'branch', 'dir', 'enabled', 'repo', 'storage'])
  })

  it('gives the project root to the dev fs store only', async () => {
    const nuxt = await run({ enabled: true, storage: 'fs' }, { dev: true })

    expect(nuxt.options.runtimeConfig.plutoCms.fsRoot).toBe('/work/site')
    expect(countKitCalls()).toBeGreaterThan(0)
  })
})
