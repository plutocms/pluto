import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildContentManifest,
  buildTypeManifest,
  gitBlobSha,
  isListedId,
  manifestModuleSource,
  versionOf,
} from '../modules/pluto-docs/manifest'
import { parseNavigationConfig } from '../shared/utils/navigation-config'

describe('gitBlobSha', () => {
  it('matches the blob id that git makes', () => {
    // `printf 'hello\n' | git hash-object --stdin`
    expect(gitBlobSha('hello\n')).toBe(
      'ce013625030ba8dba906f756967f9e9ca394464a'
    )
    expect(gitBlobSha('')).toBe('e69de29bb2d1d6434b8b29ae775ad8c2e48c5391')
  })

  it('counts UTF-8 bytes, not characters', () => {
    expect(gitBlobSha('é')).not.toBe(gitBlobSha('e'))
  })
})

describe('versionOf (CRLF)', () => {
  const lf = '---\ntitle: A\n---\nBody\n'
  const crlf = lf.replace(/\n/g, '\r\n')

  it('github: a CRLF working file has the version of the LF blob', () => {
    expect(versionOf(crlf, 'github')).toBe(versionOf(lf, 'github'))
    expect(versionOf(lf, 'github')).toBe(gitBlobSha(lf))
  })

  it('fs: the store hashes the file as it is, so the manifest does too', () => {
    expect(versionOf(crlf, 'fs')).toBe(gitBlobSha(crlf))
    expect(versionOf(crlf, 'fs')).not.toBe(versionOf(lf, 'fs'))
  })
})

describe('isListedId', () => {
  it('accepts nested ids with number prefixes', () => {
    expect(isListedId('index')).toBe(true)
    expect(isListedId('1.start/2.install')).toBe(true)
  })

  it('refuses ids that the CMS refuses', () => {
    expect(isListedId('Upper')).toBe(false)
    expect(isListedId('a b')).toBe(false)
    expect(isListedId('a/b/c/d/e/f/g')).toBe(false)
    expect(isListedId('')).toBe(false)
  })

  it('follows exclude: an id, or a folder with a slash', () => {
    expect(isListedId('index', ['index'])).toBe(false)
    expect(isListedId('drafts/one', ['drafts/'])).toBe(false)
    expect(isListedId('drafts-two/one', ['drafts/'])).toBe(true)
  })
})

describe('buildTypeManifest', () => {
  const files = [
    { path: '1.start/2.install.md', text: 'b\n' },
    { path: 'index.md', text: 'a\n' },
    { path: '1.start/.navigation.yml', text: 'title: Start\n' },
    { path: 'Bad Name.md', text: 'x' },
    { path: 'drafts/one.md', text: 'd' },
  ]

  it('lists the listed .md pages by id, sorted', () => {
    const manifest = buildTypeManifest(files, {
      storage: 'fs',
      exclude: ['drafts/'],
    })
    expect(Object.keys(manifest)).toEqual(['1.start/2.install', 'index'])
    expect(manifest.index).toBe(gitBlobSha('a\n'))
  })

  it('gives the same manifest for LF and CRLF files with the github storage', () => {
    const crlf = files.map((file) => ({
      ...file,
      text: file.text.replace(/\n/g, '\r\n'),
    }))
    expect(buildTypeManifest(crlf, { storage: 'github' })).toEqual(
      buildTypeManifest(files, { storage: 'github' })
    )
  })

  it('gives another manifest for CRLF files with the fs storage', () => {
    const crlf = files.map((file) => ({
      ...file,
      text: file.text.replace(/\n/g, '\r\n'),
    }))
    expect(buildTypeManifest(crlf, { storage: 'fs' }).index).not.toBe(
      buildTypeManifest(files, { storage: 'fs' }).index
    )
  })
})

describe('buildContentManifest (disk)', () => {
  let root = ''
  afterEach(() => root && rmSync(root, { recursive: true, force: true }))

  it('reads the files of each type folder', () => {
    root = mkdtempSync(join(tmpdir(), 'pluto-manifest-'))
    mkdirSync(join(root, 'content', '1.docs', '1.a'), { recursive: true })
    mkdirSync(join(root, 'content', 'node_modules'), { recursive: true })
    writeFileSync(join(root, 'content', 'index.md'), 'home\r\n')
    writeFileSync(join(root, 'content', '1.docs', '1.a', '1.page.md'), 'page\n')
    writeFileSync(join(root, 'content', '1.docs', '.hidden.md'), 'x')
    writeFileSync(join(root, 'content', 'node_modules', 'x.md'), 'x')
    const manifest = buildContentManifest(
      [
        { name: 'all', source: '' },
        { name: 'docs', source: '1.docs' },
      ],
      { contentDir: join(root, 'content'), storage: 'github' }
    )
    expect(Object.keys(manifest.all!)).toEqual(['1.docs/1.a/1.page', 'index'])
    expect(manifest.all!.index).toBe(gitBlobSha('home\n'))
    expect(Object.keys(manifest.docs!)).toEqual(['1.a/1.page'])
  })

  it('gives an empty type manifest for a missing folder', () => {
    expect(
      buildContentManifest([{ name: 'x', source: 'nope' }], {
        contentDir: join(tmpdir(), 'pluto-no-such-dir'),
        storage: 'fs',
      })
    ).toEqual({ x: {} })
  })

  it('matches git hash-object for a real file', () => {
    root = mkdtempSync(join(tmpdir(), 'pluto-manifest-'))
    mkdirSync(join(root, 'content'))
    writeFileSync(
      join(root, 'content', 'index.md'),
      '---\ntitle: Home\n---\nHello\n'
    )
    let expected: string
    try {
      expected = execFileSync(
        'git',
        ['hash-object', '--no-filters', join(root, 'content', 'index.md')],
        { encoding: 'utf8' }
      ).trim()
    } catch {
      return
    }
    expect(
      buildContentManifest([{ name: 'all', source: '' }], {
        contentDir: join(root, 'content'),
        storage: 'fs',
      }).all!.index
    ).toBe(expected)
  })
})

describe('manifestModuleSource', () => {
  it('is a default-export module', () => {
    const source = manifestModuleSource({ doc: { index: 'abc' } })
    expect(source).toBe('export default {"doc":{"index":"abc"}}\n')
  })
})

describe('parseNavigationConfig', () => {
  it('reads the keys of a .navigation.yml', () => {
    expect(parseNavigationConfig('title: Core\nicon: i-lucide-box\n')).toEqual({
      title: 'Core',
      icon: 'i-lucide-box',
    })
  })

  it('reads navigation: false', () => {
    expect(parseNavigationConfig('navigation: false\n')).toEqual({
      navigation: false,
    })
  })

  it('gives undefined for empty text, a list, a scalar or bad YAML', () => {
    expect(parseNavigationConfig('')).toBeUndefined()
    expect(parseNavigationConfig('- a\n- b\n')).toBeUndefined()
    expect(parseNavigationConfig('just text')).toBeUndefined()
    expect(parseNavigationConfig('a: [unclosed')).toBeUndefined()
  })
})
