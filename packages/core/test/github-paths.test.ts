import { describe, expect, it } from 'vitest'
import {
  assertSafeContentId,
  assertSafeSlug,
  contentDirPath,
  contentFilePath,
  slugifyTitle,
} from '../modules/pluto-github/runtime/server/utils/github-paths'

describe('assertSafeSlug', () => {
  it('accepts a normal slug', () => {
    for (const slug of [
      'a',
      'hello-world',
      'post-2',
      'a1-b2-c3',
      'x'.repeat(100),
    ]) {
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
    expect(contentFilePath('content', 'posts', 'hello')).toBe(
      'content/posts/hello.md'
    )
  })

  it('normalizes the dir', () => {
    expect(contentFilePath('docs\\blog/', 'posts', 'hello')).toBe(
      'docs/blog/posts/hello.md'
    )
  })

  it('rejects a bad dir, source or slug', () => {
    expect(() => contentFilePath('../content', 'posts', 'a')).toThrow()
    expect(() => contentFilePath('/abs', 'posts', 'a')).toThrow()
    expect(() => contentFilePath('content', '../posts', 'a')).toThrow()
    expect(() => contentFilePath('content', 'posts', '../a')).toThrow()
    expect(() => contentFilePath('content', '', 'a')).toThrow()
  })
})

describe('contentDirPath', () => {
  it('builds the folder of a content type', () => {
    expect(contentDirPath('content/', 'posts')).toBe('content/posts')
    expect(() => contentDirPath('content', '../x')).toThrow()
  })
})

describe('slugifyTitle', () => {
  it('makes a safe slug from a title', () => {
    expect(slugifyTitle('  Hello, World!  ')).toBe('hello-world')
    expect(slugifyTitle('Café à la carte')).toBe('cafe-a-la-carte')
    expect(slugifyTitle('???')).toBe('')
    expect(() => assertSafeSlug(slugifyTitle('A'.repeat(300)))).not.toThrow()
  })
})

describe('assertSafeContentId', () => {
  it('keeps the flat rules when the type is not nested', () => {
    expect(() => assertSafeContentId('hello-world')).not.toThrow()
    expect(() => assertSafeContentId('a/b')).toThrow()
    expect(() => assertSafeContentId('1.intro')).toThrow()
  })

  it('accepts a nested id of slug segments with an optional numeric prefix', () => {
    for (const id of [
      'index',
      'a/b',
      '1.start/2.install',
      '10.guide/index',
      'a/b/c/d/e/f',
      '1/2',
    ]) {
      expect(() => assertSafeContentId(id, { nested: true }), id).not.toThrow()
    }
  })

  it('refuses a bad nested id', () => {
    const bad = [
      '',
      '/',
      '/a',
      'a/',
      'a//b',
      '..',
      '../a',
      'a/../b',
      '.',
      './a',
      'a/.hidden',
      '.hidden',
      'a\b',
      'A/b',
      'a/B',
      '1./a',
      '1.2.a',
      'a_b',
      'a b',
      '%2e%2e/a',
      'a/b/c/d/e/f/g',
      `${'a'.repeat(100)}/${'b'.repeat(100)}/${'c'.repeat(56)}`,
      'a.md',
    ]
    for (const id of bad) {
      expect(() => assertSafeContentId(id, { nested: true }), id).toThrow()
    }
  })

  it('accepts an id of 255 characters and refuses 256', () => {
    const exact = `${'a'.repeat(100)}/${'b'.repeat(100)}/${'c'.repeat(53)}`
    expect(exact).toHaveLength(255)
    expect(() => assertSafeContentId(exact, { nested: true })).not.toThrow()
    expect(() => assertSafeContentId(`${exact}c`, { nested: true })).toThrow()
  })
})

describe('nested paths', () => {
  const nested = { nested: true }

  it('builds a file path for a nested id', () => {
    expect(
      contentFilePath('content', 'docs', '1.start/2.install', nested)
    ).toBe('content/docs/1.start/2.install.md')
  })

  it('uses the dir itself for an empty source', () => {
    expect(contentFilePath('content', '', 'index', nested)).toBe(
      'content/index.md'
    )
    expect(contentFilePath('content', '', '1.a/b', nested)).toBe(
      'content/1.a/b.md'
    )
    expect(contentDirPath('content/', '', nested)).toBe('content')
  })

  it('refuses an empty source for a flat type', () => {
    expect(() => contentFilePath('content', '', 'a')).toThrow()
    expect(() => contentDirPath('content', '')).toThrow()
  })

  it('refuses a nested id for a flat type, and a traversal for a nested type', () => {
    expect(() => contentFilePath('content', 'posts', 'a/b')).toThrow()
    expect(() => contentFilePath('content', '', '../a', nested)).toThrow()
    expect(() => contentFilePath('content', '', 'a/../b', nested)).toThrow()
    expect(() => contentFilePath('content', '../x', 'a', nested)).toThrow()
  })
})
