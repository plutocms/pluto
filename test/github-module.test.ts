import { beforeEach, describe, expect, it, vi } from 'vitest'
import githubModule from '../modules/pluto-github'
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
  await githubModule(options, nuxt)
  return nuxt
}

function handler(route: string, method?: string) {
  return kitCalls.serverHandlers.find((entry) => entry.route === route && entry.method === method)
}

beforeEach(() => {
  resetKitCalls()
})

describe('pluto-github module wiring', () => {
  it('adds nothing when disabled', async () => {
    const nuxt = await run({ enabled: false })

    expect(countKitCalls()).toBe(0)
    expect(nuxt.options.runtimeConfig).toEqual({ public: {} })
  })

  it('adds nothing when explicitly disabled', async () => {
    await run({ enabled: false, github: repo })

    expect(countKitCalls()).toBe(0)
  })

  it('adds nothing in auto mode with a layer marked as a backend', async () => {
    await run({ github: repo }, { _layers: [{ config: { $meta: { name: 'my-backend', plutoBackend: true } } }] })

    expect(countKitCalls()).toBe(0)
  })

  it('adds nothing in auto mode with the supabase module', async () => {
    await run({ github: repo }, { modules: [['@nuxtjs/supabase', {}]] })

    expect(countKitCalls()).toBe(0)
  })

  it('turns on by default when there is no backend layer', async () => {
    const nuxt = await run({ github: repo })

    expect(nuxt.options.runtimeConfig.public.plutoGithub.enabled).toBe(true)
  })

  it('stays off in production with no repo', async () => {
    vi.stubEnv('PLUTO_GITHUB_REPO', '')
    vi.stubEnv('NUXT_PLUTO_GITHUB_REPO', '')
    vi.stubEnv('VERCEL_GIT_REPO_OWNER', '')
    await run({})
    vi.unstubAllEnvs()

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

  it('adds the setup routes', async () => {
    await run({ enabled: true, github: repo })

    const posix = (value: unknown) => String(value).replaceAll('\\', '/')

    expect(posix(handler('/api/_pluto/github/setup/status', 'get')?.handler)).toMatch(/\/api\/setup\/status\.get$/)
    expect(posix(handler('/api/_pluto/github/setup/start', 'get')?.handler)).toMatch(/\/api\/setup\/start\.get$/)
    expect(posix(handler('/api/_pluto/github/setup/callback', 'get')?.handler)).toMatch(/\/api\/setup\/callback\.get$/)
  })

  it('adds the GitHub tab as a child of the Settings page', async () => {
    await run({ enabled: true, github: repo })

    const pages = [{ path: '/admin', children: [{ path: 'settings', children: [{ path: '' }, { path: 'email' }] }] }] as Array<{
 path: string
children?: Array<{
 path: string
children?: Array<{
 path: string
file?: string
}>
}>
}>
    kitCalls.pageExtenders[0]!(pages as never)

    const children = pages[0]!.children![0]!.children!
    expect(children.map((page) => page.path)).toEqual(['', 'email', 'github'])
    expect(String(children[2]!.file).replaceAll('\\', '/')).toMatch(/\/app\/components\/Pluto\/Github\/PlutoGithubSettingsPage\.vue$/)
  })

  it('adds no public read route (core serves the public API), and adds the PlutoMarkdown and PlutoMarkdownSource components', async () => {
    await run({ enabled: true, github: repo })

    const posix = (value: unknown) => String(value).replaceAll('\\', '/')

    expect(handler('/api/_pluto/github/:type', 'get')).toBeUndefined()
    expect(handler('/api/_pluto/github/:type/:slug', 'get')).toBeUndefined()
    expect(kitCalls.components).toHaveLength(2)
    expect(kitCalls.components[0]).toMatchObject({ name: 'PlutoMarkdown' })
    expect(posix(kitCalls.components[0]!.filePath)).toMatch(/\/app\/components\/Pluto\/Github\/PlutoMarkdown\.vue$/)
    expect(kitCalls.components[1]).toMatchObject({ name: 'PlutoMarkdownSource' })
    expect(posix(kitCalls.components[1]!.filePath)).toMatch(/\/app\/components\/Pluto\/Github\/PlutoMarkdownSource\.vue$/)
  })

  it('adds no server middleware: core runs the origin check for every layer', async () => {
    await run({ enabled: true, github: repo })

    expect(kitCalls.serverHandlers.filter((entry) => entry.middleware === true)).toHaveLength(0)
  })

  it('adds the Nitro plugin and the client plugin', async () => {
    await run({ enabled: true, github: repo })

    expect(kitCalls.serverPlugins).toHaveLength(1)
    expect(kitCalls.serverPlugins[0]).toMatch(/server[\\/]plugins[\\/]pluto-github$/)
    expect(kitCalls.plugins).toHaveLength(1)
    expect((kitCalls.plugins[0] as {
 src: string
}).src).toMatch(/app[\\/]plugins[\\/]pluto-github$/)
    // Core owns the route guard and the login page, so the module adds none.
    expect(kitCalls.routeMiddleware).toHaveLength(0)
    // One page: the GitHub tab of Settings.
    expect(kitCalls.pageExtenders).toHaveLength(1)
    expect(kitCalls.importsDirs).toHaveLength(1)
    expect(kitCalls.importsDirs[0]).toMatch(/app[\\/]composables$/)
  })

  it('puts the server settings in the private runtime config, and no secret in the public one', async () => {
    const nuxt = await run({ enabled: true, github: { ...repo, apiUrl: 'https://ghe.example.com/api/v3' }, cache: { headTtl: 30 } })
    const { plutoGithub } = nuxt.options.runtimeConfig

    expect(plutoGithub).toMatchObject({
      apiUrl: 'https://ghe.example.com/api/v3',
      skipDeploy: true,
      headTtl: 30,
      cacheStorage: 'cache',
      postType: true,
      fsRoot: '',
      // The setup writes `.env` in development only.
      rootDir: '',
      allowedUsers: '',
      readToken: '',
    })
    expect(Object.keys(nuxt.options.runtimeConfig.public.plutoGithub).sort()).toEqual(['appSlug', 'branch', 'dir', 'enabled', 'postType', 'repo', 'skipDeploy', 'storage'])
  })

  it('gives the project root to the dev fs store only', async () => {
    const nuxt = await run({ enabled: true, storage: 'fs' }, { dev: true })

    expect(nuxt.options.runtimeConfig.plutoGithub.fsRoot).toBe('/work/site')
    expect(nuxt.options.runtimeConfig.plutoGithub.rootDir).toBe('/work/site')
    expect(countKitCalls()).toBeGreaterThan(0)
  })
})
