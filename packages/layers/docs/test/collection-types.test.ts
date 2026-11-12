import { describe, expect, it } from 'vitest'
import { collectionTypes } from '../modules/pluto-docs/collections'

const page = (
  name: string,
  include: string,
  extra: { prefix?: string; exclude?: string[]; repository?: string } = {}
) => ({ name, type: 'page', source: [{ include, ...extra }] })

describe('collectionTypes', () => {
  it('maps Docus with a docs folder: the docs, and the landing page as the root type', () => {
    const { types, skipped } = collectionTypes([
      page('docs', 'docs/**', { prefix: '/docs', exclude: ['index.md'] }),
      page('landing', 'index.md', { prefix: '/' }),
      { name: 'info', type: 'data', private: true },
    ])
    expect(types).toEqual([
      {
        preset: 'docs',
        name: 'docs',
        source: 'docs',
        label: 'Doc',
        labelPlural: 'Docs',
        routePrefix: '/docs',
      },
      {
        preset: 'docs',
        name: 'landing',
        source: '',
        label: 'Page',
        labelPlural: 'Pages',
        exclude: ['docs/'],
      },
    ])
    expect(skipped).toEqual([])
  })

  it('maps Docus without a docs folder: the landing page joins the root type', () => {
    const { types } = collectionTypes([
      page('docs', '**', { prefix: '/', exclude: ['index.md'] }),
      page('landing', 'index.md', { prefix: '/' }),
    ])
    expect(types).toEqual([
      {
        preset: 'docs',
        name: 'docs',
        source: '',
        label: 'Page',
        labelPlural: 'Pages',
      },
    ])
  })

  it('maps Docus with locales: one type for each locale', () => {
    const { types } = collectionTypes([
      page('docs_en', 'en/docs/**', { prefix: '/en/docs', exclude: ['en/index.md'] }),
      page('landing_en', 'en/index.md', { prefix: '/en' }),
      page('docs_fr', 'fr/docs/**', { prefix: '/fr/docs', exclude: ['fr/index.md'] }),
      page('landing_fr', 'fr/index.md', { prefix: '/fr' }),
    ])
    expect(types.map((type) => [type.name, type.source, type.routePrefix, type.exclude])).toEqual([
      ['docs-en', 'en/docs', '/en/docs', undefined],
      ['docs-fr', 'fr/docs', '/fr/docs', undefined],
      ['landing-en', 'en', '/en', ['docs/']],
      ['landing-fr', 'fr', '/fr', ['docs/']],
    ])
    expect(types[0]).toMatchObject({ label: 'Doc (en)', labelPlural: 'Docs (en)' })
  })

  it('excludes the folder of a nested type from its parent', () => {
    const { types } = collectionTypes([
      page('pages', '**'),
      page('blog', 'blog/**'),
    ])
    expect(types[0]).toMatchObject({ name: 'pages', source: '', exclude: ['blog/'] })
    expect(types[1]).toMatchObject({ name: 'blog', source: 'blog', routePrefix: '/blog' })
  })

  it('reads folder and file excludes', () => {
    const { types } = collectionTypes([
      page('docs', 'docs/**', { exclude: ['docs/drafts/**', 'docs/old.md', 'other/x.md', '**/*.yml'] }),
    ])
    expect(types[0]?.exclude).toEqual(['drafts/', 'old'])
  })

  it('skips data collections, remote sources, other globs and bad names', () => {
    const { types, skipped } = collectionTypes([
      { name: 'authors', type: 'data', source: [{ include: 'authors/*.yml' }] },
      page('remote', 'docs/**', { repository: 'https://github.com/a/b' }),
      page('yaml', 'data/**/*.yml'),
      page('csv', 'table.csv'),
      page('_x', 'x/**'),
    ])
    expect(types).toEqual([])
    expect(skipped).toHaveLength(4)
  })

  it('keeps the first collection of a folder', () => {
    const { types, skipped } = collectionTypes([
      page('docs', 'docs/**'),
      page('again', 'docs/**/*.md'),
    ])
    expect(types.map((type) => type.name)).toEqual(['docs'])
    expect(skipped[0]).toContain('again')
  })
})
