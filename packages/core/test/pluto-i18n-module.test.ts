import { describe, expect, it } from 'vitest'
import {
  findLayerLocaleFiles,
  isLocaleCode,
  matchLocale,
  renderI18nTemplate,
  resolveI18nOptions,
  resolveNuxtUiLocaleFile,
} from '../modules/pluto-i18n/locale-files'

const BACKSLASH = String.fromCharCode(92)

function toPosix(path: string): string {
  return path.replaceAll(BACKSLASH, '/')
}

describe('isLocaleCode', () => {
  it('accepts a language with an optional region', () => {
    expect(isLocaleCode('en')).toBe(true)
    expect(isLocaleCode('pt-BR')).toBe(true)
    expect(isLocaleCode('fil')).toBe(true)
  })

  it('rejects anything else', () => {
    for (const value of [
      '',
      'EN',
      'pt_BR',
      'pt-br',
      'english',
      'en-',
      'messages',
      'index',
    ]) {
      expect(isLocaleCode(value)).toBe(false)
    }
  })
})

describe('findLayerLocaleFiles', () => {
  it('groups files by code, base layer first and the app last', () => {
    // Nuxt lists layers top first. POSIX input, so the test runs the same on
    // Windows and on Linux CI.
    const roots = ['/site', '/layers/shop', '/layers/pluto']
    const dirs: Record<string, string[]> = {
      '/site/i18n/locales': ['en.json', 'pt-BR.json'],
      '/layers/shop/i18n/locales': ['en.json'],
      '/layers/pluto/i18n/locales': ['pt-BR.json', 'en.json'],
    }

    expect(
      findLayerLocaleFiles(roots, (dir) => dirs[toPosix(dir)] ?? [])
    ).toEqual({
      en: [
        '/layers/pluto/i18n/locales/en.json',
        '/layers/shop/i18n/locales/en.json',
        '/site/i18n/locales/en.json',
      ],
      'pt-BR': [
        '/layers/pluto/i18n/locales/pt-BR.json',
        '/site/i18n/locales/pt-BR.json',
      ],
    })
  })

  it('ignores files that are not valid locale files', () => {
    const files = findLayerLocaleFiles(['/a'], () => [
      'en.json',
      'README.md',
      'messages.json',
      'pt_BR.json',
      'en.json.bak',
    ])

    expect(Object.keys(files)).toEqual(['en'])
  })

  it('handles a layer with no locale dir', () => {
    expect(findLayerLocaleFiles(['/a', '/b'], () => [])).toEqual({})
  })
})

describe('resolveNuxtUiLocaleFile', () => {
  const available = ['en', 'pt', 'pt_br', 'es', 'zh_cn']

  it('uses the full code first', () => {
    expect(resolveNuxtUiLocaleFile('pt-BR', available)).toBe('pt_br')
    expect(resolveNuxtUiLocaleFile('zh-CN', available)).toBe('zh_cn')
  })

  it('falls back to the base language', () => {
    expect(resolveNuxtUiLocaleFile('es-MX', available)).toBe('es')
    expect(resolveNuxtUiLocaleFile('pt-PT', available)).toBe('pt')
  })

  it('falls back to en', () => {
    expect(resolveNuxtUiLocaleFile('xx', available)).toBe('en')
  })
})

describe('matchLocale', () => {
  it('matches the full tag, ignoring case', () => {
    expect(matchLocale(['pt-br'], ['en', 'pt-BR'])).toBe('pt-BR')
  })

  it('matches the base language', () => {
    expect(matchLocale(['pt'], ['en', 'pt-BR'])).toBe('pt-BR')
    expect(matchLocale(['pt-PT'], ['en', 'pt-BR'])).toBe('pt-BR')
    expect(matchLocale(['en-US'], ['en', 'pt-BR'])).toBe('en')
  })

  it('takes the first request that matches, in order', () => {
    expect(matchLocale(['fr', 'pt-BR', 'en'], ['en', 'pt-BR'])).toBe('pt-BR')
  })

  it('returns null when nothing matches', () => {
    expect(matchLocale(['fr', 'de'], ['en', 'pt-BR'])).toBeNull()
    expect(matchLocale([], ['en'])).toBeNull()
  })
})

describe('renderI18nTemplate', () => {
  const source = renderI18nTemplate({
    files: {
      'pt-BR': [
        '/pluto/i18n/locales/pt-BR.json',
        '/site/i18n/locales/pt-BR.json',
      ],
      en: ['/pluto/i18n/locales/en.json'],
    },
    defaultLocale: 'en',
    uiLocaleDir: ['C:', 'ui', 'dist', 'runtime', 'locale'].join(BACKSLASH),
    uiLocaleFiles: ['en', 'pt_br'],
  })

  it('lists the codes and the default locale', () => {
    expect(source).toContain('export const localeCodes = ["en","pt-BR"]')
    expect(source).toContain('export const defaultLocale = "en"')
  })

  it('imports each layer file in order, in one loader per code', () => {
    expect(source).toContain(
      '"pt-BR": async () => merge(...(await Promise.all([import("/pluto/i18n/locales/pt-BR.json"), import("/site/i18n/locales/pt-BR.json")]))'
    )
  })

  it('imports the Nuxt UI locale with forward slashes', () => {
    expect(source).toContain(
      '"pt-BR": () => import("C:/ui/dist/runtime/locale/pt_br.js")'
    )
    expect(source).toContain(
      '"en": () => import("C:/ui/dist/runtime/locale/en.js")'
    )
    expect(source).not.toContain(BACKSLASH.repeat(2))
  })

  it('is valid JavaScript that exports working loaders', async () => {
    // Replace the file imports with fixtures, then run the generated code.
    const tweaked = source
      .replace(
        'import("/pluto/i18n/locales/pt-BR.json")',
        'Promise.resolve({ default: { a: { x: "1", y: "1" } } })'
      )
      .replace(
        'import("/site/i18n/locales/pt-BR.json")',
        'Promise.resolve({ default: { a: { y: "2" } } })'
      )
      .replace(
        'import("/pluto/i18n/locales/en.json")',
        'Promise.resolve({ default: {} })'
      )
      .replace(/import\("C:[^)]*\)/g, 'Promise.resolve({ default: {} })')
    const url = `data:text/javascript,${encodeURIComponent(tweaked)}`
    const mod = await import(/* @vite-ignore */ url)

    expect(mod.localeCodes).toEqual(['en', 'pt-BR'])
    expect(await mod.messageLoaders['pt-BR']()).toEqual({
      a: { x: '1', y: '2' },
    })
  })
})

describe('resolveI18nOptions', () => {
  it('defaults to the discovered locales', () => {
    expect(resolveI18nOptions({}, ['en', 'pt-BR'])).toEqual({
      defaultLocale: 'en',
      adminLocales: ['en', 'pt-BR'],
      siteLocales: ['en', 'pt-BR'],
      siteLocale: 'en',
      siteManaged: false,
      warnings: [],
    })
  })

  it('marks the site as managed only when the app sets a site option', () => {
    expect(
      resolveI18nOptions({ siteLocale: 'pt-BR' }, ['en', 'pt-BR']).siteManaged
    ).toBe(true)
    expect(
      resolveI18nOptions({ siteLocales: ['en'] }, ['en', 'pt-BR']).siteManaged
    ).toBe(true)
    expect(
      resolveI18nOptions({ adminLocales: ['en'] }, ['en', 'pt-BR']).siteManaged
    ).toBe(false)
  })

  it('keeps the options that name a discovered locale', () => {
    const resolved = resolveI18nOptions(
      { adminLocales: ['pt-BR'], siteLocales: ['en'], siteLocale: 'en' },
      ['en', 'pt-BR']
    )

    expect(resolved.adminLocales).toEqual(['pt-BR'])
    expect(resolved.siteLocales).toEqual(['en'])
    expect(resolved.warnings).toEqual([])
  })

  it('drops an unknown locale and warns', () => {
    const resolved = resolveI18nOptions({ adminLocales: ['en', 'fr'] }, [
      'en',
      'pt-BR',
    ])

    expect(resolved.adminLocales).toEqual(['en'])
    expect(resolved.warnings).toHaveLength(1)
    expect(resolved.warnings[0]).toContain('"fr"')
  })

  it('falls back to en when the default or site locale is not usable', () => {
    const resolved = resolveI18nOptions(
      { defaultLocale: 'fr', siteLocale: 'de' },
      ['en']
    )

    expect(resolved.defaultLocale).toBe('en')
    expect(resolved.siteLocale).toBe('en')
    expect(resolved.warnings).toHaveLength(2)
  })
})
