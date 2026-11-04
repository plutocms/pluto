import { describe, expect, it } from 'vitest'
import { formatPublishedDate } from '../shared/utils/public-api'

describe('formatPublishedDate', () => {
  it('formats publishedAt, else createdAt, in UTC', () => {
    expect(
      formatPublishedDate({
        createdAt: '2026-01-02T10:00:00Z',
        publishedAt: '2026-03-04T23:30:00-03:00',
      })
    ).toBe('Mar 5, 2026')
    expect(formatPublishedDate({ createdAt: '2026-01-02' })).toBe('Jan 2, 2026')
  })

  it('takes the Intl options, a locale and a time zone', () => {
    const post = { publishedAt: '2026-03-04T23:30:00-03:00' }
    expect(formatPublishedDate(post, { dateStyle: 'long' })).toBe(
      'March 5, 2026'
    )
    expect(formatPublishedDate(post, { timeZone: 'America/Sao_Paulo' })).toBe(
      'Mar 4, 2026'
    )
    expect(formatPublishedDate(post, { locale: 'pt-BR', month: 'long' })).toBe(
      'março'
    )
  })

  it('gives an empty string with no date or a bad one', () => {
    expect(formatPublishedDate({})).toBe('')
    expect(formatPublishedDate({ publishedAt: 'soon' })).toBe('')
  })
})
