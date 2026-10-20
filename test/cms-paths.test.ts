import { describe, expect, it } from 'vitest'
import { assertSafeSlug, contentFilePath } from '../modules/pluto-cms/runtime/server/utils/cms-paths'

describe('assertSafeSlug', () => {
  it('accepts a normal slug', () => {
    for (const slug of ['a', 'hello-world', 'post-2', 'a1-b2-c3', 'x'.repeat(100)]) {
      expect(() => assertSafeSlug(slug)).not.toThrow()
    }
  })

  it('rejects anything else', () => {
    const bad = [
      '',
      '..',
      '../x',
      'a/b',
      'a\\b',
      '%2e%2e',
      '%2E',
      'Hello',
      'a_b',
      'a--b',
      '-a',
      'a-',
      'a b',
      'café',
      '‮a',
      'a.md',
      'x'.repeat(101),
    ]
    for (const slug of bad) {
      expect(() => assertSafeSlug(slug), slug).toThrow()
    }
  })
})

describe('contentFilePath', () => {
  it('builds the path under the dir', () => {
    expect(contentFilePath('content', 'posts', 'hello')).toBe('content/posts/hello.md')
  })

  it('normalizes the dir', () => {
    expect(contentFilePath('docs\\blog/', 'posts', 'hello')).toBe('docs/blog/posts/hello.md')
  })

  it('rejects a bad dir, source or slug', () => {
    expect(() => contentFilePath('../content', 'posts', 'a')).toThrow()
    expect(() => contentFilePath('/abs', 'posts', 'a')).toThrow()
    expect(() => contentFilePath('content', '../posts', 'a')).toThrow()
    expect(() => contentFilePath('content', 'posts', '../a')).toThrow()
    expect(() => contentFilePath('content', '', 'a')).toThrow()
  })
})
