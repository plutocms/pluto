import { describe, expect, it } from 'vitest'
import {
  buildNavigationTree,
  diffManifest,
  flattenNavigation,
  folderItemFields,
  frontmatterExtras,
  isRootIndexId,
  pageIdForRoute,
  surroundOf,
  titleFromSegment,
} from '../shared/utils/runtime-content'

const pages = [
  { id: 'index', title: 'Home' },
  {
    id: '1.start/1.index',
    title: 'Start here',
    navigationIcon: 'i-lucide-rocket',
  },
  { id: '1.start/2.install', title: 'Install', description: 'How to install' },
  { id: '1.start/3.secret', title: 'Secret', navigationHidden: true },
  { id: '2.core/01.layers', title: 'Layers' },
  { id: '2.core/02.forms', title: 'Forms', navigationTitle: 'Form fields' },
  { id: '3.guides/1.deep/1.one', title: 'One' },
]

describe('buildNavigationTree', () => {
  const tree = buildNavigationTree(pages)

  it('leaves out the root index and the hidden pages', () => {
    const paths = JSON.stringify(tree)
    expect(paths).not.toContain('"/"')
    expect(paths).not.toContain('secret')
  })

  it('keeps the root index with includeRoot', () => {
    expect(buildNavigationTree(pages, { includeRoot: true })[0]).toMatchObject({
      title: 'Home',
      path: '/',
      stem: 'index',
    })
  })

  it('merges the index page into its folder', () => {
    expect(tree[0]).toEqual({
      title: 'Start here',
      path: '/start',
      stem: '1.start/1.index',
      icon: 'i-lucide-rocket',
      children: [
        {
          title: 'Start here',
          path: '/start',
          stem: '1.start/1.index',
          icon: 'i-lucide-rocket',
        },
        { title: 'Install', path: '/start/install', stem: '1.start/2.install' },
      ],
    })
  })

  it('makes a placeholder folder with page false and a title from the name', () => {
    expect(tree[1]).toMatchObject({
      title: 'Core',
      path: '/core',
      stem: '2.core',
      page: false,
    })
    expect(tree[1]!.children!.map((child) => child.title)).toEqual([
      'Layers',
      'Form fields',
    ])
  })

  it('nests folders', () => {
    const guides = tree[2]!
    expect(guides).toMatchObject({ title: 'Guides', page: false })
    expect(guides.children![0]).toMatchObject({
      title: 'Deep',
      path: '/guides/deep',
      page: false,
    })
    expect(guides.children![0]!.children![0]).toMatchObject({
      title: 'One',
      path: '/guides/deep/one',
    })
  })

  it('uses the route prefix', () => {
    const prefixed = buildNavigationTree(
      [
        { id: '1.a/1.index', title: 'A' },
        { id: '1.a/2.b', title: 'B' },
      ],
      { routePrefix: '/docs' }
    )
    expect(prefixed[0]).toMatchObject({ path: '/docs/a' })
    expect(prefixed[0]!.children!.map((child) => child.path)).toEqual([
      '/docs/a',
      '/docs/a/b',
    ])
  })

  it('adds the description only on request', () => {
    expect(JSON.stringify(tree)).not.toContain('How to install')
    expect(
      JSON.stringify(buildNavigationTree(pages, { withDescription: true }))
    ).toContain('How to install')
  })

  it('folds an index that comes after its siblings into the placeholder', () => {
    const late = buildNavigationTree([
      { id: '1.a/2.b', title: 'B' },
      { id: '1.a/index', title: 'A' },
    ])
    expect(late[0]).toMatchObject({ title: 'A', path: '/a' })
    expect(late[0]!.page).toBeUndefined()
    expect(late[0]!.children!.map((child) => child.path)).toEqual([
      '/a',
      '/a/b',
    ])
  })
})

describe('flattenNavigation and surroundOf', () => {
  const tree = buildNavigationTree(pages, { withDescription: true })

  it('lists the pages in reading order, once each', () => {
    expect(flattenNavigation(tree).map((item) => item.path)).toEqual([
      '/start',
      '/start/install',
      '/core/layers',
      '/core/forms',
      '/guides/deep/one',
    ])
  })

  it('gives the neighbors', () => {
    expect(surroundOf(tree, '/start/install')).toEqual([
      { title: 'Start here', path: '/start', stem: '1.start/1.index' },
      { title: 'Layers', path: '/core/layers', stem: '2.core/01.layers' },
    ])
  })

  it('gives null at the ends', () => {
    expect(surroundOf(tree, '/start')[0]).toBeNull()
    expect(surroundOf(tree, '/guides/deep/one')[1]).toBeNull()
  })

  it('gives two nulls for an unknown path', () => {
    expect(surroundOf(tree, '/nope')).toEqual([null, null])
  })

  it('keeps the description of a neighbor', () => {
    expect(surroundOf(tree, '/start')[1]).toMatchObject({
      description: 'How to install',
    })
  })
})

describe('pageIdForRoute', () => {
  const ids = pages.map((page) => page.id)

  it('matches a route without the number prefixes', () => {
    expect(pageIdForRoute(ids, '/core/layers')).toBe('2.core/01.layers')
    expect(pageIdForRoute(ids, '/start')).toBe('1.start/1.index')
    expect(pageIdForRoute(ids, '/')).toBe('index')
  })

  it('ignores a trailing slash and finds nothing for an unknown route', () => {
    expect(pageIdForRoute(ids, '/core/layers/')).toBe('2.core/01.layers')
    expect(pageIdForRoute(ids, '/nope')).toBeUndefined()
  })

  it('uses the route prefix', () => {
    expect(pageIdForRoute(ids, '/docs/core/layers', '/docs')).toBe(
      '2.core/01.layers'
    )
  })
})

describe('small helpers', () => {
  it('titles a folder name', () => {
    expect(titleFromSegment('getting-started')).toBe('Getting Started')
  })

  it('finds the root index id', () => {
    expect(isRootIndexId('index')).toBe(true)
    expect(isRootIndexId('1.index')).toBe(true)
    expect(isRootIndexId('a/index')).toBe(false)
  })
})

describe('diffManifest', () => {
  const manifest = {
    index: 'a1',
    '1.start/1.install': 'b2',
    '1.start/2.old': 'c3',
  }

  it('is the same when ids and versions match', () => {
    const diff = diffManifest(manifest, [
      { id: 'index', version: 'a1' },
      { id: '1.start/1.install', version: 'b2' },
      { id: '1.start/2.old', version: 'c3' },
    ])
    expect(diff).toEqual({ same: true, changed: [], added: [], removed: [] })
  })

  it('finds a changed, an added and a removed page', () => {
    const diff = diffManifest(manifest, [
      { id: 'index', version: 'a1' },
      { id: '1.start/1.install', version: 'NEW' },
      { id: '2.more/1.page', version: 'd4' },
    ])
    expect(diff).toEqual({
      same: false,
      changed: ['1.start/1.install'],
      added: ['2.more/1.page'],
      removed: ['1.start/2.old'],
    })
  })

  it('counts an entry without a version as changed', () => {
    expect(diffManifest({ a: 'x' }, [{ id: 'a' }]).changed).toEqual(['a'])
  })

  it('has no manifest: every page is added', () => {
    expect(diffManifest(undefined, [{ id: 'a', version: 'x' }])).toMatchObject({
      same: false,
      added: ['a'],
    })
  })
})

describe('folder configs (.navigation.yml)', () => {
  const folders = {
    '1.start': { title: 'Getting started', icon: 'i-lucide-rocket' },
    '2.core': { title: 'The core', navigation: { icon: 'i-lucide-box' } },
    '4.hidden': { navigation: false },
  }
  const withFolders = [
    ...pages,
    { id: '4.hidden/1.index', title: 'Hidden index' },
    { id: '4.hidden/2.page', title: 'Hidden page' },
  ]
  const tree = buildNavigationTree(withFolders, { folders })

  it('keeps the title and the other keys of the config on an index folder', () => {
    expect(tree[0]).toMatchObject({
      title: 'Getting started',
      icon: 'i-lucide-rocket',
      path: '/start',
    })
    // The index child keeps the page title.
    expect(tree[0]!.children![0]).toMatchObject({ title: 'Start here' })
  })

  it('gives a placeholder folder the title and the icon of the config', () => {
    expect(tree[1]).toMatchObject({
      title: 'The core',
      icon: 'i-lucide-box',
      page: false,
    })
  })

  it('lets the navigation object override the keys', () => {
    expect(
      folderItemFields({ title: 'A', icon: 'x', navigation: { title: 'B' } })
    ).toEqual({ title: 'B', icon: 'x' })
  })

  it('hides a folder with navigation false, with all its pages', () => {
    expect(JSON.stringify(tree)).not.toContain('hidden')
  })

  it('ignores an empty title and the default "navigation" title', () => {
    expect(folderItemFields({ title: '', icon: 'x' })).toEqual({ icon: 'x' })
    expect(folderItemFields({ title: 'Navigation' })).toEqual({})
  })

  it('works without configs', () => {
    expect(folderItemFields(undefined)).toEqual({})
    expect(buildNavigationTree(pages, { folders: {} })).toEqual(
      buildNavigationTree(pages)
    )
  })
})

describe('frontmatterExtras', () => {
  it('passes unknown keys at the top level and in meta', () => {
    const { top, meta } = frontmatterExtras({
      title: 'T',
      links: [{ label: 'A' }],
      layout: 'wide',
      badge: { label: 'New' },
    })
    expect(top).toEqual({
      links: [{ label: 'A' }],
      layout: 'wide',
      badge: { label: 'New' },
    })
    expect(meta).toEqual(top)
  })

  it('leaves out the page fields and the form-only keys', () => {
    const { top } = frontmatterExtras({
      title: 'T',
      description: 'D',
      seo: { title: 'S' },
      navigation: false,
      path: '/x',
      body: 'b',
      navigationTitle: 'N',
      navigationIcon: 'I',
      navigationHidden: true,
      seoTitle: 'S',
      seoDescription: 'D',
      extra: 1,
    })
    expect(top).toEqual({ extra: 1 })
  })

  it('handles no frontmatter', () => {
    expect(frontmatterExtras(undefined)).toEqual({ top: {}, meta: {} })
  })
})
