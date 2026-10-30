import { describe, expect, it } from 'vitest'
import { slugifyTitle } from '../shared/utils/content-slug'

describe('slugifyTitle', () => {
  it('drops accents', () => {
    expect(slugifyTitle('Pão de Mel')).toBe('pao-de-mel')
    expect(slugifyTitle('Coração')).toBe('coracao')
    expect(slugifyTitle('Café à la carte')).toBe('cafe-a-la-carte')
  })

  it('collapses symbols and trims dashes', () => {
    expect(slugifyTitle('  Hello,   World!  ')).toBe('hello-world')
    expect(slugifyTitle('--a__b--')).toBe('a-b')
  })

  it('keeps digits', () => {
    expect(slugifyTitle('Peça 2 de 10')).toBe('peca-2-de-10')
  })

  it('returns an empty string when nothing is left', () => {
    expect(slugifyTitle('???')).toBe('')
    expect(slugifyTitle('')).toBe('')
  })

  it('cuts at 100 characters without a trailing dash', () => {
    const slug = slugifyTitle(`${'a'.repeat(99)} b`)
    expect(slug).toBe('a'.repeat(99))
    expect(slugifyTitle('A'.repeat(300))).toHaveLength(100)
  })
})
