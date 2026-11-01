import { describe, expect, it } from 'vitest'
import {
  analyzeCssEntry,
  checkCssSetup,
  findLayerCssFiles,
  parseCssImports,
  renderPlutoAdminCss,
  renderPlutoCss,
  renderPlutoEntryCss,
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
  it('follows local imports and reports what the entry imports', () => {
    const files: Record<string, string> = {
      '/site/main.css': `@import 'tailwindcss';\n@import './parts/ui.css';`,
      '/site/parts/ui.css': `@import '@nuxt/ui';\n@import '@plutocms/css';`,
    }
    const info = analyzeCssEntry(
      '/site/main.css',
      (path) => files[path],
      (specifier, from) =>
        specifier.startsWith('./')
          ? `${from.slice(0, from.lastIndexOf('/'))}/${specifier.slice(2)}`
          : undefined
    )

    expect(info).toMatchObject({ tailwind: true, nuxtUi: true, plutoCss: true })
  })

  const pluto = (css: string) =>
    analyzeCssEntry(
      '/site/main.css',
      () => css,
      () => undefined
    ).plutoCss

  it('accepts @plutocms/css and the generated file as the Pluto import', () => {
    expect(pluto(`@import 'tailwindcss';\n@import '@plutocms/css';`)).toBe(true)
    expect(pluto(`@import 'tailwindcss';\n@import '#build/pluto.css';`)).toBe(
      true
    )
  })

  it('does not take the site theme for the Pluto import', () => {
    expect(pluto(`@import 'tailwindcss';\n@import '@plutocms/css/site';`)).toBe(
      false
    )
  })
})

describe('renderPlutoEntryCss', () => {
  it('imports Tailwind, Nuxt UI, and @plutocms/css, in that order', () => {
    expect(parseCssImports(renderPlutoEntryCss())).toEqual([
      'tailwindcss',
      '@nuxt/ui',
      '@plutocms/css',
    ])
  })
})

describe('renderPlutoAdminCss', () => {
  it('imports the full build with the isolated option, and nothing without it', () => {
    expect(parseCssImports(renderPlutoAdminCss(true))).toEqual([
      'tailwindcss',
      '@nuxt/ui',
      '@plutocms/css',
    ])
    expect(parseCssImports(renderPlutoAdminCss(false))).toEqual([])
  })
})

describe('checkCssSetup', () => {
  const app = (
    overrides: Partial<{
      file: string
      tailwind: boolean
      nuxtUi: boolean
      plutoCss: boolean
    }> = {}
  ) => ({
    file: '/site/app/assets/css/main.css',
    tailwind: true,
    nuxtUi: true,
    plutoCss: true,
    ...overrides,
  })

  it('injects the fallback when no entry imports Tailwind', () => {
    expect(checkCssSetup([], ['/layers/pluto/'])).toEqual({
      injectFallback: true,
      warnings: [],
    })
  })

  it('is silent for the correct setup', () => {
    expect(checkCssSetup([app()], ['/layers/pluto/'])).toEqual({
      injectFallback: false,
      warnings: [],
    })
  })

  it('warns about a layer that registers its own Tailwind build', () => {
    const report = checkCssSetup(
      [
        app(),
        app({
          file: '/layers/shop/app/assets/css/tailwind.css',
          plutoCss: false,
        }),
      ],
      ['/layers/shop/']
    )

    expect(report.warnings.join('\n')).toMatch(
      /Layer \/layers\/shop\/ registers its own Tailwind build/
    )
    expect(report.warnings.join('\n')).toMatch(/Found 2 Tailwind builds/)
  })

  it('with the isolated build: no fallback, and the app entry is free', () => {
    expect(checkCssSetup([], [], { isolated: true })).toEqual({
      injectFallback: false,
      warnings: [],
    })
    expect(
      checkCssSetup([app({ plutoCss: false, nuxtUi: false })], [], {
        isolated: true,
      })
    ).toEqual({ injectFallback: false, warnings: [] })
  })

  it('with the isolated build: still warns about a layer build', () => {
    const report = checkCssSetup(
      [app(), app({ file: '/layers/shop/app/assets/css/tailwind.css' })],
      ['/layers/shop/'],
      { isolated: true }
    )
    expect(report.warnings.join('\n')).toMatch(
      /registers its own Tailwind build/
    )
  })

  it('warns when the app misses @plutocms/css or @nuxt/ui', () => {
    const report = checkCssSetup([app({ plutoCss: false, nuxtUi: false })], [])

    expect(report.warnings).toHaveLength(2)
    expect(report.warnings[0]).toMatch(/No CSS entry imports @plutocms\/css/)
    expect(report.warnings[1]).toMatch(/No CSS entry imports @nuxt\/ui/)
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
