import { describe, expect, it, vi } from 'vitest'
import cmsModule from '../modules/pluto-cms'
import {
  PLUTO_CMS_SECRET_ENV,
  resolvePlutoCmsOptions,
  SUPABASE_CONFLICT_ERROR,
} from '../modules/pluto-cms/options'

vi.mock('@nuxt/kit', async (importOriginal) => (await import('./fixtures/kit-mock')).kitMock(await importOriginal<object>()))

const ctx = { dev: false, hasSupabaseLayer: false }
const repo = { repo: 'acme/site' }

describe('resolvePlutoCmsOptions', () => {
  it('is disabled by default, with no errors', () => {
    const result = resolvePlutoCmsOptions({}, ctx)

    expect(result.enabled).toBe(false)
    expect(result.errors).toEqual([])
  })

  it('stays silent when disabled, even with a supabase layer', () => {
    const result = resolvePlutoCmsOptions({ enabled: false }, { ...ctx, hasSupabaseLayer: true })

    expect(result.enabled).toBe(false)
    expect(result.errors).toEqual([])
  })

  it('fills the defaults when enabled', () => {
    const result = resolvePlutoCmsOptions({ enabled: true, github: repo }, ctx)

    expect(result.errors).toEqual([])
    expect(result.enabled).toBe(true)
    expect(result.resolved).toEqual({
      storage: 'github',
      github: { repo: 'acme/site', branch: 'main', appSlug: '', apiUrl: 'https://api.github.com' },
      dir: 'content',
      commit: { skipDeploy: true },
      cache: { headTtl: 60, storage: 'cache', publicMaxAge: 60 },
      postType: true,
    })
  })

  it('keeps explicit values', () => {
    const result = resolvePlutoCmsOptions({
      enabled: true,
      github: { repo: 'acme/site', branch: 'dev', appSlug: 'my-app', apiUrl: 'https://ghe.example.com/api/v3/' },
      dir: 'posts\\blog/',
      commit: { skipDeploy: false },
      cache: { headTtl: 0, storage: 'redis', publicMaxAge: 0 },
      postType: false,
    }, ctx)

    expect(result.enabled).toBe(true)
    expect(result.resolved.github.apiUrl).toBe('https://ghe.example.com/api/v3')
    expect(result.resolved.dir).toBe('posts/blog')
    expect(result.resolved.commit.skipDeploy).toBe(false)
    expect(result.resolved.cache).toEqual({ headTtl: 0, storage: 'redis', publicMaxAge: 0 })
    expect(result.resolved.postType).toBe(false)
  })

  it('refuses to run with the supabase layer', () => {
    const result = resolvePlutoCmsOptions({ enabled: true, github: repo }, { ...ctx, hasSupabaseLayer: true })

    expect(result.enabled).toBe(false)
    expect(result.errors).toEqual([SUPABASE_CONFLICT_ERROR])
  })

  it('rejects a bad repo', () => {
    for (const bad of ['', 'acme', 'acme/site/extra', 'acme /site', '/site']) {
      const result = resolvePlutoCmsOptions({ enabled: true, github: { repo: bad } }, ctx)

      expect(result.enabled).toBe(false)
      expect(result.errors).toHaveLength(1)
    }
  })

  it('rejects an unsafe dir', () => {
    for (const bad of ['../x', '/abs', 'C:\\x', 'a/../b', '', '.', '  ']) {
      const result = resolvePlutoCmsOptions({ enabled: true, github: repo, dir: bad }, ctx)

      expect(result.enabled, bad).toBe(false)
      expect(result.errors, bad).toHaveLength(1)
    }
  })

  it('rejects the fs store outside dev', () => {
    const result = resolvePlutoCmsOptions({ enabled: true, storage: 'fs' }, ctx)

    expect(result.enabled).toBe(false)
    expect(result.errors).toHaveLength(1)
  })

  it('accepts the fs store in dev, with no repo', () => {
    const result = resolvePlutoCmsOptions({ enabled: true, storage: 'fs' }, { ...ctx, dev: true })

    expect(result.errors).toEqual([])
    expect(result.enabled).toBe(true)
  })

  it('rejects a negative or invalid headTtl', () => {
    for (const bad of [-1, Number.NaN]) {
      const result = resolvePlutoCmsOptions({ enabled: true, github: repo, cache: { headTtl: bad } }, ctx)

      expect(result.enabled).toBe(false)
      expect(result.errors).toHaveLength(1)
    }
  })

  it('rejects a negative or invalid publicMaxAge', () => {
    for (const bad of [-1, Number.NaN]) {
      const result = resolvePlutoCmsOptions({ enabled: true, github: repo, cache: { publicMaxAge: bad } }, ctx)

      expect(result.enabled).toBe(false)
      expect(result.errors).toHaveLength(1)
    }
  })

  it('lists the run-time secret names', () => {
    expect(PLUTO_CMS_SECRET_ENV.required).toContain('SESSION_PASSWORD')
    expect(PLUTO_CMS_SECRET_ENV.optional).toEqual(['GITHUB_READ_TOKEN', 'ALLOWED_USERS'])
  })
})

describe('pluto-cms module', () => {
  function stubNuxt(extra: Record<string, unknown> = {}) {
    return {
      options: {
        dev: false,
        _prepare: true,
        _layers: [],
        modules: [],
        runtimeConfig: { public: {} } as Record<string, any>,
        ...extra,
      },
      hook() {},
    } as any
  }

  it('adds nothing to runtimeConfig when disabled', async () => {
    const nuxt = stubNuxt()

    await cmsModule({}, nuxt)

    expect(nuxt.options.runtimeConfig).toEqual({ public: {} })
  })

  it('adds nothing when enabled with the supabase layer', async () => {
    const nuxt = stubNuxt({ _layers: [{ config: { $meta: { name: 'supabase' } } }] })

    await cmsModule({ enabled: true, github: repo }, nuxt)

    expect(nuxt.options.runtimeConfig).toEqual({ public: {} })
  })

  it('writes the runtime config when enabled', async () => {
    const nuxt = stubNuxt()

    await cmsModule({ enabled: true, github: repo }, nuxt)

    expect(nuxt.options.runtimeConfig.public.plutoCms).toMatchObject({ enabled: true, repo: 'acme/site', dir: 'content' })
    expect(nuxt.options.runtimeConfig.plutoCms.githubPrivateKey).toBe('')
  })
})
