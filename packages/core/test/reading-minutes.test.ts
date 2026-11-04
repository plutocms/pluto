import { describe, expect, it } from 'vitest'
import { readingMinutes } from '../shared/utils/public-api'

describe('readingMinutes', () => {
  it('counts the words of the text, not the tags', () => {
    const words = (n: number) =>
      Array.from({ length: n }).fill('word').join(' ')
    expect(readingMinutes(`<p>${words(440)}</p>`)).toBe(2)
    expect(
      readingMinutes(`<h2 class="title">${words(100)}</h2><p>${words(230)}</p>`)
    ).toBe(2)
    expect(readingMinutes(words(300), 100)).toBe(3)
  })

  it('is at least 1', () => {
    expect(readingMinutes('')).toBe(1)
    expect(readingMinutes('<img src="a.png">')).toBe(1)
  })
})
