import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderServerI18nModule } from '../modules/pluto-i18n/locale-files'
import { createPlutoServerTranslatorFactory } from '../server/utils/pluto-i18n'

function source(
  overrides: {
    loads?: string[]
  } = {}
) {
  const trees: Record<string, Record<string, unknown>> = {
    en: { hello: 'Hello {name}', only: { en: 'English only' } },
    'pt-BR': { hello: 'Olá {name}' },
  }
  return {
    localeCodes: ['en', 'pt-BR'],
    defaultLocale: 'en',
    messageLoaders: Object.fromEntries(
      Object.entries(trees).map(([code, tree]) => [
        code,
        async () => {
          overrides.loads?.push(code)
          return tree
        },
      ])
    ),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createPlutoServerTranslatorFactory', () => {
  it('translates in the requested locale', async () => {
    const getTranslator = createPlutoServerTranslatorFactory(source())

    const pt = await getTranslator('pt-BR')

    expect(pt.locale).toBe('pt-BR')
    expect(pt.t('hello', { name: 'Ana' })).toBe('Olá Ana')
  })

  it('matches a base language or a different case', async () => {
    const getTranslator = createPlutoServerTranslatorFactory(source())

    expect((await getTranslator('pt')).locale).toBe('pt-BR')
    expect((await getTranslator('pt-br')).locale).toBe('pt-BR')
  })

  it('uses the default locale for an unknown or missing locale', async () => {
    const getTranslator = createPlutoServerTranslatorFactory(source())

    expect((await getTranslator('fr')).locale).toBe('en')
    expect((await getTranslator()).locale).toBe('en')
    expect((await getTranslator(null)).t('hello', { name: 'Bob' })).toBe(
      'Hello Bob'
    )
  })

  it('falls back to the default locale for a missing key', async () => {
    const getTranslator = createPlutoServerTranslatorFactory(source())
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const pt = await getTranslator('pt-BR')

    expect(pt.t('only.en')).toBe('English only')
    expect(pt.te('only.en')).toBe(true)
    expect(pt.t('nothing.here')).toBe('nothing.here')
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('loads each locale once', async () => {
    const loads: string[] = []
    const getTranslator = createPlutoServerTranslatorFactory(source({ loads }))

    await Promise.all([
      getTranslator('pt-BR'),
      getTranslator('pt-BR'),
      getTranslator('en'),
    ])
    await getTranslator('pt-BR')

    expect(loads.toSorted()).toEqual(['en', 'pt-BR'])
  })
})

describe('usePlutoServerTranslator', () => {
  it('reads the Nitro virtual module', async () => {
    vi.resetModules()
    vi.doMock('#pluto-i18n-server', () => source())
    const { usePlutoServerTranslator } =
      await import('../server/utils/pluto-i18n')

    const translator = await usePlutoServerTranslator('pt-BR')

    expect(translator.t('hello', { name: 'Ana' })).toBe('Olá Ana')
    vi.doUnmock('#pluto-i18n-server')
  })
})

describe('renderServerI18nModule', () => {
  const rendered = renderServerI18nModule({
    files: { 'pt-BR': ['/p/pt-BR.json', '/s/pt-BR.json'], en: ['/p/en.json'] },
    defaultLocale: 'en',
  })

  it('lists the codes, the default locale and one loader per code', () => {
    expect(rendered).toContain('export const localeCodes = ["en","pt-BR"]')
    expect(rendered).toContain('export const defaultLocale = "en"')
    expect(rendered).toContain(
      '"pt-BR": async () => merge(...(await Promise.all([import("/p/pt-BR.json"), import("/s/pt-BR.json")]))'
    )
  })

  it('has no Nuxt UI locale', () => {
    expect(rendered).not.toContain('uiLocaleLoaders')
  })

  it('exports working loaders', async () => {
    const tweaked = rendered
      .replace(
        'import("/p/pt-BR.json")',
        'Promise.resolve({ default: { a: { x: "1", y: "1" } } })'
      )
      .replace(
        'import("/s/pt-BR.json")',
        'Promise.resolve({ default: { a: { y: "2" } } })'
      )
      .replace('import("/p/en.json")', 'Promise.resolve({ default: {} })')
    const mod = await import(
      /* @vite-ignore */ `data:text/javascript,${encodeURIComponent(tweaked)}`
    )

    expect(await mod.messageLoaders['pt-BR']()).toEqual({
      a: { x: '1', y: '2' },
    })
  })
})
