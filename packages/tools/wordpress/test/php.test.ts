import { describe, expect, it } from 'vitest'
import { unserialize } from '../src/php'
import { phpSerialize } from './fixtures'

describe('unserialize', () => {
  it('reads scalars', () => {
    expect(unserialize('N;')).toBeNull()
    expect(unserialize('b:1;')).toBe(true)
    expect(unserialize('b:0;')).toBe(false)
    expect(unserialize('i:-42;')).toBe(-42)
    expect(unserialize('d:0.5;')).toBe(0.5)
    expect(unserialize('s:5:"hello";')).toBe('hello')
  })

  it('counts a string by its bytes, not its characters', () => {
    expect(unserialize('s:7:"café à";')).toBe('café à')
    expect(unserialize('s:4:"\u{1F600}";')).toBe('\u{1F600}')
  })

  it('reads a string that holds the characters of the format', () => {
    expect(unserialize('s:9:"a";b:1;"x";')).toBe('a";b:1;"x')
  })

  it('turns an array with keys 0, 1, 2 into a list', () => {
    expect(unserialize('a:2:{i:0;s:1:"a";i:1;s:1:"b";}')).toEqual(['a', 'b'])
  })

  it('turns any other array into an object, and reads nested values', () => {
    const source = 'a:2:{s:3:"one";i:1;s:5:"inner";a:1:{s:1:"k";N;}}'

    expect(unserialize(source)).toEqual({ one: 1, inner: { k: null } })
  })

  it('reads an object as a plain object', () => {
    const source = 'O:8:"stdClass":1:{s:1:"a";i:1;}'

    expect(unserialize(source)).toEqual({ a: 1 })
  })

  it('round trips what the fixture writer makes', () => {
    const value = { list: [1, 'two', true, null], name: 'São Paulo' }

    expect(unserialize(phpSerialize(value))).toEqual(value)
  })

  it('throws on a type it does not know', () => {
    expect(() => unserialize('x:1;')).toThrow('not supported')
  })
})
