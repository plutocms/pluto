import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative as relativePath, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { plutoLayer, plutoLayerEnvName } from '../layers'

const ENV_NAMES = [
  'PLUTO_LOCAL_ROOT',
  'PLUTO_USE_LOCAL',
  ...[
    'UTILS',
    'UI',
    'PLUTO',
    'SUPABASE',
    'SUPABASE_SHOP',
    'SUPABASE_BLOG',
    'SUPABASE_BLOG',
    'NUXT_CONTENT',
  ].map((name) => `PLUTO_${name}_PATH`),
]

let root = ''
let saved: Record<string, string | undefined> = {}

function checkout(folder: string) {
  mkdirSync(join(root, folder), { recursive: true })
  writeFileSync(join(root, folder, 'nuxt.config.ts'), 'export default {}\n')
}

beforeEach(() => {
  saved = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]))
  for (const name of ENV_NAMES) {
    delete process.env[name]
  }
  root = mkdtempSync(join(tmpdir(), 'pluto-layers-'))
})

afterEach(() => {
  for (const name of ENV_NAMES) {
    if (saved[name] === undefined) {
      delete process.env[name]
    } else {
      process.env[name] = saved[name]
    }
  }
  rmSync(root, { recursive: true, force: true })
})

describe('plutoLayerEnvName', () => {
  it('upper-cases the name and changes "-" to "_"', () => {
    expect(plutoLayerEnvName('@plutocms/nuxt-content')).toBe(
      'PLUTO_NUXT_CONTENT_PATH'
    )
    expect(plutoLayerEnvName('supabase-shop')).toBe('PLUTO_SUPABASE_SHOP_PATH')
  })
})

describe('plutoLayer', () => {
  it('returns the package with install on by default', () => {
    expect(plutoLayer('@plutocms/nuxt-content')).toEqual([
      '@plutocms/nuxt-content',
      { install: true },
    ])
  })

  it('accepts install: false', () => {
    expect(
      plutoLayer('@plutocms/supabase-blog', { install: false })
    ).toEqual(['@plutocms/supabase-blog', { install: false }])
  })

  it('sets nothing when no root is set', () => {
    checkout('pluto')
    plutoLayer('@plutocms/pluto')

    expect(process.env.PLUTO_PLUTO_PATH).toBeUndefined()
  })

  it('returns the local path and sets the path of every existing checkout', () => {
    checkout('nuxt-content')
    checkout('pluto')
    checkout('supabase-shop')
    process.env.PLUTO_LOCAL_ROOT = root

    const entry = plutoLayer('@plutocms/nuxt-content')

    expect(entry).toEqual([resolve(root, 'nuxt-content'), { install: true }])
    expect(process.env.PLUTO_NUXT_CONTENT_PATH).toBe(
      resolve(root, 'nuxt-content')
    )
    expect(process.env.PLUTO_PLUTO_PATH).toBe(resolve(root, 'pluto'))
    expect(process.env.PLUTO_SUPABASE_SHOP_PATH).toBe(
      resolve(root, 'supabase-shop')
    )
    expect(process.env.PLUTO_UTILS_PATH).toBeUndefined()
    expect(process.env.PLUTO_SUPABASE_BLOG_PATH).toBeUndefined()
  })

  it('returns the package name when the checkout is missing', () => {
    checkout('pluto')
    process.env.PLUTO_LOCAL_ROOT = root

    expect(plutoLayer('@plutocms/supabase')).toEqual([
      '@plutocms/supabase',
      { install: true },
    ])
    expect(process.env.PLUTO_PLUTO_PATH).toBe(resolve(root, 'pluto'))
  })

  it('ignores a folder with no nuxt.config.ts', () => {
    mkdirSync(join(root, 'supabase-blog'))
    process.env.PLUTO_LOCAL_ROOT = root

    plutoLayer('@plutocms/pluto')

    expect(process.env.PLUTO_SUPABASE_BLOG_PATH).toBeUndefined()
  })

  it('keeps an explicit PLUTO_<NAME>_PATH', () => {
    checkout('pluto')
    checkout('nuxt-content')
    process.env.PLUTO_LOCAL_ROOT = root
    process.env.PLUTO_PLUTO_PATH = '/custom/pluto'

    expect(plutoLayer('@plutocms/pluto')).toEqual([
      '/custom/pluto',
      { install: true },
    ])
    expect(process.env.PLUTO_PLUTO_PATH).toBe('/custom/pluto')
    expect(plutoLayer('@plutocms/nuxt-content')[0]).toBe(
      resolve(root, 'nuxt-content')
    )
  })

  it('uses an explicit PLUTO_<NAME>_PATH without a root', () => {
    process.env.PLUTO_SUPABASE_BLOG_PATH = '../supabase-blog'

    expect(plutoLayer('@plutocms/supabase-blog')).toEqual([
      '../supabase-blog',
      { install: true },
    ])
  })

  it('does nothing when PLUTO_USE_LOCAL is false', () => {
    checkout('pluto')
    process.env.PLUTO_LOCAL_ROOT = root
    process.env.PLUTO_USE_LOCAL = 'false'

    expect(plutoLayer('@plutocms/pluto')).toEqual([
      '@plutocms/pluto',
      { install: true },
    ])
    expect(process.env.PLUTO_PLUTO_PATH).toBeUndefined()
  })

  it('lets options.root win over PLUTO_LOCAL_ROOT', () => {
    checkout('pluto')
    process.env.PLUTO_LOCAL_ROOT = join(root, 'nowhere')

    expect(plutoLayer('@plutocms/pluto', { root })[0]).toBe(
      resolve(root, 'pluto')
    )
  })

  it('resolves a relative root from the working directory', () => {
    checkout('pluto')
    const relative = relativePath(process.cwd(), root)
    process.env.PLUTO_LOCAL_ROOT = relative

    expect(plutoLayer('@plutocms/pluto')[0]).toBe(resolve(root, 'pluto'))
  })
})
