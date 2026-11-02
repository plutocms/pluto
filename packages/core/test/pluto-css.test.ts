import { describe, expect, it } from 'vitest'
import {
  analyzeCssEntry,
  checkCssSetup,
  findLayerCssFiles,
  parseCssImports,
  renderPlutoAdminCss,
  renderPlutoCss,
  renderPlutoSiteCss,
} from '../modules/pluto-css/css-entries'

describe('findLayerCssFiles', () => {
  it('returns existing layer files, base layer first', () => {
    // Nuxt lists layers top first: the app, then the layers it extends.
    // POSIX input, so the test runs the same on Windows and on Linux CI.
    const appDirs = [
      '/site/app/',
      '/layers/shop/app/',
      '/layers/ui/app/',
      '/layers/pluto/app/',
    ]
    const existing = new Set([
      '/layers/shop/app/assets/css/pluto-layer.css',
      '/layers/pluto/app/assets/css/pluto-layer.css',
    ])

    expect(findLayerCssFiles(appDirs, (path) => existing.has(path))).toEqual([
      '/layers/pluto/app/assets/css/pluto-layer.css',
      '/layers/shop/app/assets/css/pluto-layer.css',
    ])
  })
})

describe('renderPlutoCss', () => {
  it('imports each file relative to the build dir', () => {
    const css = renderPlutoCss(
      ['/work/pluto/app/assets/css/pluto-layer.css'],
      '/work/site/.nuxt'
    )

    expect(css).toContain(
      '@import "../../pluto/app/assets/css/pluto-layer.css";'
    )
    expect(css).not.toContain('tailwindcss')
  })
})

describe('parseCssImports', () => {
  it('reads every import form and ignores comments', () => {
    const css = [
      `@import 'tailwindcss' source(none);`,
      `@import "@nuxt/ui";`,
      `/* @import 'commented-out'; */`,
      `@import url('./a.css');`,
      `@import url(./b.css) layer(base);`,
      `@import '#build/pluto.css';`,
    ].join('\n')

    expect(parseCssImports(css)).toEqual([
      'tailwindcss',
      '@nuxt/ui',
      './a.css',
      './b.css',
      '#build/pluto.css',
    ])
  })
})

describe('analyzeCssEntry', () => {
  const resolveLocal = (specifier: string, from: string) =>
    specifier.startsWith('./')
      ? `${from.slice(0, from.lastIndexOf('/'))}/${specifier.slice(2)}`
      : undefined

  it('finds a Tailwind import through local imports', () => {
    const files: Record<string, string> = {
      '/site/main.css': `@import './parts/base.css';`,
      '/site/parts/base.css': `@import 'tailwindcss';\n@import '@nuxt/ui';`,
    }
    const info = analyzeCssEntry(
      '/site/main.css',
      (path) => files[path],
      resolveLocal
    )

    expect(info).toEqual({ file: '/site/main.css', tailwind: true })
  })

  it('reports a plain CSS entry', () => {
    const info = analyzeCssEntry(
      '/site/main.css',
      () => `body { margin: 0 }`,
      resolveLocal
    )

    expect(info.tailwind).toBe(false)
  })
})

describe('renderPlutoAdminCss', () => {
  it('imports Tailwind, Nuxt UI, and @plutocms/css, in that order', () => {
    expect(parseCssImports(renderPlutoAdminCss())).toEqual([
      'tailwindcss',
      '@nuxt/ui',
      '@plutocms/css',
    ])
  })
})

describe('checkCssSetup', () => {
  const app = (file = '/site/app/assets/css/main.css', tailwind = true) => ({
    file,
    tailwind,
  })

  it('is silent for an app with no Tailwind entry, or one', () => {
    expect(checkCssSetup([], ['/layers/pluto/'])).toEqual([])
    expect(checkCssSetup([app('/site/plain.css', false)], [])).toEqual([])
    expect(checkCssSetup([app()], ['/layers/pluto/'])).toEqual([])
  })

  it('warns about a layer that registers its own Tailwind build', () => {
    const warnings = checkCssSetup(
      [app(), app('/layers/shop/app/assets/css/tailwind.css')],
      ['/layers/shop/']
    )

    expect(warnings.join('\n')).toMatch(
      /Layer \/layers\/shop\/ registers its own Tailwind build/
    )
    expect(warnings.join('\n')).toMatch(/Found 2 Tailwind builds/)
  })
})

describe('renderPlutoSiteCss', () => {
  it('imports the site theme of core relative to the build dir', () => {
    const css = renderPlutoSiteCss(
      '/work/pluto/app/assets/css/pluto-site-theme.css',
      '/work/site/.nuxt'
    )

    expect(css).toContain(
      '@import "../../pluto/app/assets/css/pluto-site-theme.css";'
    )
  })
})
