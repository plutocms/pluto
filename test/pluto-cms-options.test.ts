import { describe, expect, it, vi } from 'vitest'
import cmsModule from '../modules/pluto-cms'
import {
  PLUTO_CMS_SECRET_ENV,
  resolvePlutoCmsOptions,
  SUPABASE_CONFLICT_ERROR,
} from '../modules/pluto-cms/options'

vi.mock('@nuxt/kit', async (importOriginal) => (await import('./fixtures/kit-mock')).kitMock(await importOriginal<object>()))

const ctx = { dev: false, hasBackendLayer: false }
const dev = { ...ctx, dev: true }
const repo = { repo: 'acme/site' }

describe('resolvePlutoCmsOptions', () => {
  it('is disabled by false, with no errors', () => {
    const result = resolvePlutoCmsOptions({ enabled: false }, ctx)

    expect(result.enabled).toBe(false)
    expect(result.errors).toEqual([])
  })

  it('is on by default when there is no backend layer', () => {
    const result = resolvePlutoCmsOptions({ github: repo }, ctx)

    expect(result.errors).toEqual([])
    expect(result.enabled).toBe(true)
  })

  it('accepts "auto" and is on with no backend layer', () => {
    const result = resolvePlutoCmsOptions({ enabled: 'auto', github: repo }, ctx)

    expect(result.enabled).toBe(true)
  })

  it('is off with no log in auto mode when a backend layer is present', () => {
    for (const enabled of [undefined, 'auto'] as const) {
      const result = resolvePlutoCmsOptions({ enabled, github: repo }, { ...ctx, hasBackendLayer: true })

      expect(result.enabled).toBe(false)
      expect(result.errors).toEqual([])
    }
  })

  it('rejects a value that is not true, false or "auto"', () => {
    const result = resolvePlutoCmsOptions({ enabled: 'yes' as never }, ctx)

    expect(result.enabled).toBe(false)
    expect(result.errors).toHaveLength(1)
  })

  it('stays silent when disabled, even with a supabase layer', () => {
    const result = resolvePlutoCmsOptions({ enabled: false }, { ...ctx, hasBackendLayer: true })

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
    const result = resolvePlutoCmsOptions({ enabled: true, github: repo }, { ...ctx, hasBackendLayer: true })

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

describe('resolvePlutoCmsOptions defaults', () => {
  it('uses fs in dev and github in production', () => {
    expect(resolvePlutoCmsOptions({}, dev).resolved.storage).toBe('fs')
    expect(resolvePlutoCmsOptions({ github: repo }, ctx).resolved.storage).toBe('github')
  })

  it('keeps an explicit storage', () => {
    expect(resolvePlutoCmsOptions({ storage: 'github', github: repo }, dev).resolved.storage).toBe('github')
  })

  it('reads the storage from PLUTO_CMS_STORAGE, below an explicit option', () => {
    const env = { PLUTO_CMS_STORAGE: 'github' }

    expect(resolvePlutoCmsOptions({ github: repo }, { ...dev, env }).resolved.storage).toBe('github')
    expect(resolvePlutoCmsOptions({ storage: 'fs' }, { ...dev, env }).resolved.storage).toBe('fs')
  })

  it('is on in dev with no repo, because fs needs none', () => {
    const result = resolvePlutoCmsOptions({}, dev)

    expect(result.errors).toEqual([])
    expect(result.enabled).toBe(true)
  })

  it('reads the repo from NUXT_PLUTO_CMS_GITHUB_REPO, then PLUTO_CMS_REPO', () => {
    const both = { NUXT_PLUTO_CMS_GITHUB_REPO: 'a/one', PLUTO_CMS_REPO: 'b/two' }

    expect(resolvePlutoCmsOptions({}, { ...ctx, env: both }).resolved.github.repo).toBe('a/one')
    expect(resolvePlutoCmsOptions({}, { ...ctx, env: { PLUTO_CMS_REPO: 'b/two' } }).resolved.github.repo).toBe('b/two')
  })

  it('reads the repo from the Vercel env vars after the explicit env vars', () => {
    const vercel = { VERCEL_GIT_REPO_OWNER: 'acme', VERCEL_GIT_REPO_SLUG: 'site' }

    expect(resolvePlutoCmsOptions({}, { ...ctx, env: vercel }).resolved.github.repo).toBe('acme/site')
    expect(resolvePlutoCmsOptions({}, { ...ctx, env: { ...vercel, PLUTO_CMS_REPO: 'b/two' } }).resolved.github.repo).toBe('b/two')
    expect(resolvePlutoCmsOptions({}, { ...ctx, env: { VERCEL_GIT_REPO_OWNER: 'acme' } }).resolved.github.repo).toBe('')
  })

  it('reads the repo from the git remote in dev only', () => {
    const gitOrigin = 'git@github.com:acme/site.git'

    expect(resolvePlutoCmsOptions({}, { ...dev, gitOrigin }).resolved.github.repo).toBe('acme/site')
    expect(resolvePlutoCmsOptions({}, { ...ctx, gitOrigin }).resolved.github.repo).toBe('')
  })

  it('ignores a git remote that is not on GitHub', () => {
    const result = resolvePlutoCmsOptions({}, { ...dev, gitOrigin: 'https://gitlab.com/acme/site.git' })

    expect(result.resolved.github.repo).toBe('')
  })

  it('lets the explicit repo win over every default', () => {
    const env = { PLUTO_CMS_REPO: 'b/two' }
    const result = resolvePlutoCmsOptions({ github: repo }, { ...dev, env, gitOrigin: 'git@github.com:c/three.git' })

    expect(result.resolved.github.repo).toBe('acme/site')
  })

  it('stays off with one clear error in production with no repo', () => {
    const result = resolvePlutoCmsOptions({}, ctx)

    expect(result.enabled).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('needs a GitHub repo')
  })

  it('reads the app slug from the env, below an explicit option', () => {
    const env = { PLUTO_CMS_APP_SLUG: 'from-env' }

    expect(resolvePlutoCmsOptions({ github: repo }, { ...ctx, env }).resolved.github.appSlug).toBe('from-env')
    expect(resolvePlutoCmsOptions({ github: { ...repo, appSlug: 'mine' } }, { ...ctx, env }).resolved.github.appSlug).toBe('mine')
    expect(resolvePlutoCmsOptions({ github: repo }, { ...ctx, env: { NUXT_PLUTO_CMS_GITHUB_APP_SLUG: 'nuxt-env' } }).resolved.github.appSlug).toBe('nuxt-env')
  })

  it('defaults the branch to main', () => {
    expect(resolvePlutoCmsOptions({ github: repo }, ctx).resolved.github.branch).toBe('main')
  })
})
