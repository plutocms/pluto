import { describe, expect, it } from 'vitest'
import {
  contentEditPath,
  contentNewPath,
  contentRoutePath,
} from '../shared/utils/content-route'

describe('contentRoutePath', () => {
  it('maps the landing page to /', () => {
    expect(contentRoutePath('index')).toBe('/')
  })

  it('strips the number prefixes', () => {
    expect(contentRoutePath('1.getting-started/2.installation')).toBe(
      '/getting-started/installation'
    )
    expect(contentRoutePath('2.core/03.content-model')).toBe(
      '/core/content-model'
    )
  })

  it('drops a final index, with or without a number', () => {
    expect(contentRoutePath('1.getting-started/1.index')).toBe(
      '/getting-started'
    )
    expect(contentRoutePath('3.github-cms/index')).toBe('/github-cms')
  })

  it('keeps an index that is not the last segment', () => {
    expect(contentRoutePath('index/page')).toBe('/index/page')
  })

  it('keeps names without a prefix', () => {
    expect(contentRoutePath('about')).toBe('/about')
    expect(contentRoutePath('guides/intro')).toBe('/guides/intro')
  })

  it('does not strip a number in the middle of a name', () => {
    expect(contentRoutePath('1.v2-notes')).toBe('/v2-notes')
    expect(contentRoutePath('top-10')).toBe('/top-10')
  })

  it('adds a route prefix', () => {
    expect(contentRoutePath('1.start/2.install', '/docs')).toBe(
      '/docs/start/install'
    )
    expect(contentRoutePath('index', 'docs/')).toBe('/docs')
  })
})

describe('contentEditPath', () => {
  it('keeps the slashes of a nested id', () => {
    expect(contentEditPath('doc', '2.core/03.content-model')).toBe(
      '/admin/content/doc/2.core/03.content-model'
    )
  })

  it('encodes each segment', () => {
    expect(contentEditPath('doc', 'guides/a b?')).toBe(
      '/admin/content/doc/guides/a%20b%3F'
    )
    expect(contentEditPath('my type', 'index')).toBe(
      '/admin/content/my%20type/index'
    )
  })
})

describe('contentNewPath', () => {
  it('gives the create form of a type', () => {
    expect(contentNewPath('doc')).toBe('/admin/content/doc/new')
  })
})
