import { describe, expect, it, vi } from 'vitest'
import {
  createLocaleCache,
  createTranslator,
  flattenMessages,
  formatDate,
  formatNumber,
  getLanguageName,
  interpolate,
  isMessageKey,
  matchLocale,
  mergeMessageTrees,
  parseAcceptLanguage,
  selectPlural,
} from '../app/composables/internal/i18n-core'

describe('isMessageKey', () => {
  it('accepts dotted keys', () => {
    for (const key of [
      'pluto.common.save',
      'content.post.fields.title.label',
      'supabase-blog.posts.list-title',
      'site.nav.home',
      '3d.kind',
    ]) {
      expect(isMessageKey(key)).toBe(true)
    }
  })

  it('rejects plain labels and other values', () => {
    for (const value of [
      'Save',
      'Posts',
      'new post',
      'Hello.',
      'pluto',
      'pluto.',
      '.pluto.save',
      'Pluto.common.save',
      'a b.c',
      '',
    ]) {
      expect(isMessageKey(value)).toBe(false)
    }
    expect(isMessageKey(undefined)).toBe(false)
    expect(isMessageKey(42)).toBe(false)
  })
})

describe('flattenMessages', () => {
  it('flattens nested trees to dotted keys', () => {
    expect(flattenMessages({ a: { b: 'x', c: { d: 'y' } }, e: 'z' })).toEqual({
      'a.b': 'x',
      'a.c.d': 'y',
      e: 'z',
    })
  })
})

describe('mergeMessageTrees', () => {
  it('lets a later tree override, deeply, without losing other keys', () => {
    const base = { a: { x: '1', y: '1' }, b: 'base' }
    const app = { a: { y: '2' }, c: 'app' }

    expect(mergeMessageTrees(base, app)).toEqual({
      a: { x: '1', y: '2' },
      b: 'base',
      c: 'app',
    })
    expect(base.a.y).toBe('1')
  })
})

describe('interpolate', () => {
  it('replaces named params', () => {
    expect(
      interpolate('Hello {name}, you have {count} items', {
        name: 'Ana',
        count: 3,
      })
    ).toBe('Hello Ana, you have 3 items')
  })

  it('keeps a missing param as it is', () => {
    expect(interpolate('Hello {name}', {})).toBe('Hello {name}')
    expect(interpolate('Hello {name}')).toBe('Hello {name}')
  })

  it('replaces a param that is 0', () => {
    expect(interpolate('{n} left', { n: 0 })).toBe('0 left')
  })
})

describe('selectPlural', () => {
  it('returns a single form as it is', () => {
    expect(selectPlural('Posts', 5, 'en')).toBe('Posts')
  })

  it('uses one | other with Intl.PluralRules', () => {
    expect(selectPlural('{count} post | {count} posts', 1, 'en')).toBe(
      '{count} post'
    )
    expect(selectPlural('{count} post | {count} posts', 0, 'en')).toBe(
      '{count} posts'
    )
    expect(selectPlural('{count} post | {count} posts', 2, 'en')).toBe(
      '{count} posts'
    )
  })

  it('treats 0 as one in pt-BR for two forms', () => {
    // pt-BR PluralRules gives "one" for 0.
    expect(new Intl.PluralRules('pt-BR').select(0)).toBe('one')
    expect(selectPlural('{count} post | {count} posts', 0, 'pt-BR')).toBe(
      '{count} post'
    )
  })

  it('uses zero | one | other, and the zero form wins for 0 in every locale', () => {
    const message = 'No posts | One post | {count} posts'

    expect(selectPlural(message, 0, 'en')).toBe('No posts')
    expect(selectPlural(message, 0, 'pt-BR')).toBe('No posts')
    expect(selectPlural(message, 1, 'en')).toBe('One post')
    expect(selectPlural(message, 1, 'pt-BR')).toBe('One post')
    expect(selectPlural(message, 5, 'pt-BR')).toBe('{count} posts')
  })
})

function makeTranslator(locale: string) {
  const warn = vi.fn()
  const messages: Record<string, Record<string, string>> = {
    en: {
      'a.hello': 'Hello {name}',
      'a.only-en': 'Only English',
      'a.posts': 'No posts | One post | {count} posts',
    },
    pt: {
      'a.hello': 'Olá {name}',
      'a.posts': 'Nenhum post | Um post | {count} posts',
    },
  }
  const state = { locale }
  const translator = createTranslator({
    locale: () => state.locale,
    messages: (code) => messages[code],
    warn,
  })
  return { ...translator, state, warn }
}

describe('createTranslator', () => {
  it('translates in the active locale, with params', () => {
    expect(makeTranslator('pt').t('a.hello', { name: 'Ana' })).toBe('Olá Ana')
  })

  it('follows a change of the active locale', () => {
    const tr = makeTranslator('en')

    expect(tr.t('a.hello', { name: 'Ana' })).toBe('Hello Ana')
    tr.state.locale = 'pt'
    expect(tr.t('a.hello', { name: 'Ana' })).toBe('Olá Ana')
  })

  it('falls back to en, then to the key', () => {
    const tr = makeTranslator('pt')

    expect(tr.t('a.only-en')).toBe('Only English')
    expect(tr.t('a.nowhere')).toBe('a.nowhere')
  })

  it('falls back to en when the locale is not loaded', () => {
    expect(makeTranslator('fr').t('a.hello', { name: 'Ana' })).toBe('Hello Ana')
  })

  it('warns once for each missing key', () => {
    const tr = makeTranslator('en')
    tr.t('a.nowhere')
    tr.t('a.nowhere')
    tr.t('a.other')

    expect(tr.warn).toHaveBeenCalledTimes(2)
  })

  it('does not warn for a key found in the fallback', () => {
    const tr = makeTranslator('pt')
    tr.t('a.only-en')

    expect(tr.warn).not.toHaveBeenCalled()
  })

  it('picks a plural form from a count', () => {
    const tr = makeTranslator('pt')

    expect(tr.t('a.posts', 0)).toBe('Nenhum post')
    expect(tr.t('a.posts', { count: 1 })).toBe('Um post')
    expect(tr.t('a.posts', { count: 7 })).toBe('7 posts')
  })

  it('reports a key with te, in the active locale or the fallback', () => {
    const tr = makeTranslator('pt')

    expect(tr.te('a.hello')).toBe(true)
    expect(tr.te('a.only-en')).toBe(true)
    expect(tr.te('a.nowhere')).toBe(false)
  })

  describe('tx', () => {
    it('translates a value that is a known key', () => {
      expect(makeTranslator('pt').tx('a.hello', { name: 'Ana' })).toBe(
        'Olá Ana'
      )
    })

    it('returns a literal as it is', () => {
      const tr = makeTranslator('pt')

      expect(tr.tx('Posts')).toBe('Posts')
      expect(tr.tx('Save changes.')).toBe('Save changes.')
    })

    it('returns a key-shaped value that does not exist as it is, with no warning', () => {
      const tr = makeTranslator('pt')

      expect(tr.tx('v1.2')).toBe('v1.2')
      expect(tr.tx('a.nowhere')).toBe('a.nowhere')
      expect(tr.warn).not.toHaveBeenCalled()
    })
  })
})

describe('createLocaleCache', () => {
  it('loads a locale once and shares one promise', async () => {
    const loader = vi.fn(async () => ({ a: { b: 'x' } }))
    const cache = createLocaleCache({ en: loader }, flattenMessages)

    expect(cache.get('en')).toBeUndefined()
    await Promise.all([cache.load('en'), cache.load('en')])
    await cache.load('en')

    expect(loader).toHaveBeenCalledTimes(1)
    expect(cache.get('en')).toEqual({ 'a.b': 'x' })
  })

  it('ignores a locale with no loader', async () => {
    const cache = createLocaleCache({}, (value: string) => value)
    await cache.load('fr')

    expect(cache.get('fr')).toBeUndefined()
  })
})

describe('formatters', () => {
  it('formats numbers per locale', () => {
    expect(formatNumber('en', 1234.5)).toBe('1,234.5')
    expect(formatNumber('pt-BR', 1234.5)).toBe('1.234,5')
    expect(formatNumber('en', 0.5, { style: 'percent' })).toBe('50%')
  })

  it('formats dates per locale', () => {
    const date = new Date(Date.UTC(2026, 9, 18, 12))

    expect(
      formatDate('en', date, { dateStyle: 'medium', timeZone: 'UTC' })
    ).toBe('Oct 18, 2026')
    expect(
      formatDate('pt-BR', date.getTime(), {
        dateStyle: 'medium',
        timeZone: 'UTC',
      })
    ).toBe('18 de out. de 2026')
  })

  it('reuses one Intl formatter for the same locale and options', () => {
    const spy = vi.spyOn(Intl, 'NumberFormat')
    formatNumber('en', 1, { maximumFractionDigits: 7 })
    formatNumber('en', 2, { maximumFractionDigits: 7 })

    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
})

describe('getLanguageName', () => {
  it('names a language in its own language, with a capital first letter', () => {
    expect(getLanguageName('en')).toBe('English')
    expect(getLanguageName('pt-BR')).toBe('Português (Brasil)')
  })
})

describe('parseAcceptLanguage', () => {
  it('orders tags by quality and drops q=0 and *', () => {
    expect(parseAcceptLanguage('en;q=0.5, pt-BR, fr;q=0, *;q=0.1')).toEqual([
      'pt-BR',
      'en',
    ])
  })

  it('returns an empty list for no header', () => {
    expect(parseAcceptLanguage(undefined)).toEqual([])
    expect(parseAcceptLanguage('')).toEqual([])
  })

  it('works with matchLocale', () => {
    expect(
      matchLocale(parseAcceptLanguage('pt-PT,pt;q=0.9,en;q=0.8'), [
        'en',
        'pt-BR',
      ])
    ).toBe('pt-BR')
  })
})
