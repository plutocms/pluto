import { describe, expect, it } from 'vitest'
import { compareContentIds, contentIdPath } from '../shared/utils/content-id'

describe('contentIdPath', () => {
  it('keeps the slash between segments and encodes each segment', () => {
    expect(contentIdPath('1.start/2.install')).toBe('1.start/2.install')
    expect(contentIdPath('a b/c?d')).toBe('a%20b/c%3Fd')
    expect(contentIdPath('a%2Fb')).toBe('a%252Fb')
  })

  it('gives the same text as encodeURIComponent for a flat id', () => {
    expect(contentIdPath('hello-world')).toBe('hello-world')
    expect(contentIdPath(42)).toBe('42')
  })
})

describe('compareContentIds', () => {
  const sorted = (ids: string[]) => [...ids].sort(compareContentIds)

  it('puts index first in its folder', () => {
    expect(sorted(['b', 'index', 'a'])).toEqual(['index', 'a', 'b'])
    expect(sorted(['1.a/2.x', '1.a/index', '1.a/1.y'])).toEqual(['1.a/index', '1.a/1.y', '1.a/2.x'])
  })

  it('sorts a numeric prefix as a number', () => {
    expect(sorted(['10.j', '2.b', '1.a'])).toEqual(['1.a', '2.b', '10.j'])
  })

  it('puts a numbered segment before a plain one, then sorts by name', () => {
    expect(sorted(['zeta', '3.c', 'alpha'])).toEqual(['3.c', 'alpha', 'zeta'])
    expect(sorted(['1.b', '1.a'])).toEqual(['1.a', '1.b'])
  })

  it('compares segment by segment, so a folder keeps its items together', () => {
    expect(sorted(['2.b/index', '1.a/z', 'index', '1.a/index', '2.b'])).toEqual([
      'index',
      '1.a/index',
      '1.a/z',
      '2.b',
      '2.b/index',
    ])
  })

  it('returns 0 for the same id', () => {
    expect(compareContentIds('1.a/b', '1.a/b')).toBe(0)
  })
})
