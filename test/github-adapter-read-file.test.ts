import type { H3Event } from 'h3'
import type { PlutoGithubAccess } from '../modules/pluto-github/runtime/server/adapter'
import type { PlutoGithubStore } from '../modules/pluto-github/runtime/server/store/types'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createMarkdownContentAdapter } from '../modules/pluto-github/runtime/server/adapter'
import { createFsStore } from '../modules/pluto-github/runtime/server/store/fs'
import { createGithubStore } from '../modules/pluto-github/runtime/server/store/github'
import { createMemoryStore } from '../modules/pluto-github/runtime/server/store/memory'
import { gitBlobSha } from '../modules/pluto-github/runtime/server/utils/blob-sha'
import { createGithubCache } from '../modules/pluto-github/runtime/server/utils/github-cache'
import { typeRelativePath } from '../modules/pluto-github/runtime/server/utils/github-paths'
import { plutoGithubPostType } from '../modules/pluto-github/runtime/shared/post-type'
import { createFakeGithub } from './fixtures/fake-github'
import { nestedType } from './fixtures/nested-type'

const event = {} as H3Event
const EDITOR = ['posts:read_drafts', 'posts:publish', 'posts:delete']

const NAV = 'title: Guide\nicon: i-lucide-book\n'
const files: Record<string, string> = {
  'content/docs/index.md': '---\ntitle: Home\nstatus: published\n---\nHome\n',
  'content/docs/1.guide/.navigation.yml': NAV,
  'content/docs/1.guide/1.start.md': '---\ntitle: Start\nstatus: published\ncustom: yes\nnested:\n  key: 1\n---\nStart\n',
  'content/docs/1.guide/2.draft.md': '---\ntitle: Draft\nstatus: draft\n---\nSecret\n',
  'content/other/y.md': '---\ntitle: Other\nstatus: published\n---\nOther\n',
  'content/secret.txt': 'outside the type folder',
}

function adapterFor(store: PlutoGithubStore, signedIn: boolean) {
  const adapter = createMarkdownContentAdapter({
    store,
    dir: 'content',
    getAccess: async (): Promise<PlutoGithubAccess | null> => signedIn ? { capabilities: EDITOR, auth: { token: 't' } } : null,
  })
  return { adapter, ctx: { event, type: nestedType } }
}

function githubStore() {
  const github = createFakeGithub({ files })
  return createGithubStore({
    repo: github.repo,
    branch: github.branch,
    apiUrl: 'https://api.github.com',
    cache: createGithubCache({ headTtl: 60 }),
    fetch: github.fetch,
  })
}

const stores: [string, () => Promise<{
 store: PlutoGithubStore
done?: () => Promise<void>
}>][] = [
  ['memory', async () => ({ store: createMemoryStore(files) })],
  ['github', async () => ({ store: githubStore() })],
  ['fs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pluto-readfile-'))
    const store = createFsStore({ root })
    await store.commit({
      expectedHeadOid: await store.head(),
      message: 'seed',
      additions: Object.entries(files).map(([path, contents]) => ({ path, contents })),
      deletions: [],
    }, { token: 't' })
    return { store, done: async () => rm(root, { recursive: true, force: true }) }
  }],
]

describe.each(stores)('adapter readFile over the %s store', (_name, make) => {
  it('reads a raw file of the type folder with its version', async () => {
    const { store, done } = await make()
    try {
      const { adapter, ctx } = adapterFor(store, true)

      expect(await adapter.readFile!(ctx, '1.guide/.navigation.yml')).toEqual({
        text: NAV,
        version: gitBlobSha(NAV),
      })
      const md = await adapter.readFile!(ctx, '1.guide/1.start.md')
      expect(md?.text).toBe(files['content/docs/1.guide/1.start.md'])
      expect(md?.version).toBe((await adapter.get(ctx, '1.guide/1.start'))?._version)
    } finally {
      await done?.()
    }
  })

  it('gives null for a missing file or a folder', async () => {
    const { store, done } = await make()
    try {
      const { adapter, ctx } = adapterFor(store, true)

      expect(await adapter.readFile!(ctx, 'missing.md')).toBeNull()
      expect(await adapter.readFile!(ctx, '1.guide')).toBeNull()
    } finally {
      await done?.()
    }
  })

  it('refuses unsafe paths', async () => {
    const { store, done } = await make()
    try {
      const { adapter, ctx } = adapterFor(store, true)
      const bad = [
        '',
        '..',
        '../other/y.md',
        '../../secret.txt',
        '1.guide/../../other/y.md',
        '/content/other/y.md',
        '/etc/passwd',
        'C:/Windows/win.ini',
        'C:\\Windows\\win.ini',
        '1.guide\\1.start.md',
        '..\\other\\y.md',
        '%2e%2e/other/y.md',
        '1.guide//1.start.md',
        './index.md',
        '1.guide/./1.start.md',
        'index.md\u0000.png',
      ]
      for (const path of bad) {
        expect(await adapter.readFile!(ctx, path), path).toBeNull()
      }
    } finally {
      await done?.()
    }
  })

  it('hides a draft from an anonymous caller, and shows it to an editor', async () => {
    const { store, done } = await make()
    try {
      const anonymous = adapterFor(store, false)
      const editor = adapterFor(store, true)

      expect(await anonymous.adapter.readFile!(anonymous.ctx, '1.guide/2.draft.md')).toBeNull()
      expect((await editor.adapter.readFile!(editor.ctx, '1.guide/2.draft.md'))?.text).toContain('Secret')
      expect((await anonymous.adapter.readFile!(anonymous.ctx, '1.guide/1.start.md'))?.text).toContain('Start')
      expect((await anonymous.adapter.readFile!(anonymous.ctx, '1.guide/.navigation.yml'))?.text).toBe(NAV)
    } finally {
      await done?.()
    }
  })
})

describe('adapter get frontmatter', () => {
  it('returns the whole frontmatter as _frontmatter on get, not on list', async () => {
    const { adapter, ctx } = adapterFor(createMemoryStore(files), true)

    const item = await adapter.get(ctx, '1.guide/1.start')
    expect(item?._frontmatter).toEqual({ title: 'Start', status: 'published', custom: 'yes', nested: { key: 1 } })

    const list = await adapter.list(ctx, { includeUnpublished: true })
    expect(list.data.every((entry) => entry._frontmatter === undefined)).toBe(true)
  })

  it('runs the read hook first, and gives a copy', async () => {
    const type = {
      ...plutoGithubPostType,
      source: 'posts',
      files: { frontmatter: { read: (fm: Record<string, unknown>) => ({ ...fm, extra: 'added' }) } },
    }
    const adapter = createMarkdownContentAdapter({
      store: createMemoryStore({ 'content/posts/a.md': '---\ntitle: A\nstatus: published\n---\nBody\n' }),
      dir: 'content',
      getAccess: async () => null,
    })
    const ctx = { event, type }

    const first = await adapter.get(ctx, 'a')
    expect(first?._frontmatter).toEqual({ title: 'A', status: 'published', extra: 'added' })
    ;(first!._frontmatter as Record<string, unknown>).title = 'Changed'
    expect((await adapter.get(ctx, 'a'))?._frontmatter?.title).toBe('A')
  })
})

describe('typeRelativePath', () => {
  it('joins a safe relative path to the folder', () => {
    expect(typeRelativePath('content/docs', 'a/b.md')).toBe('content/docs/a/b.md')
    expect(typeRelativePath('content/docs', '.navigation.yml')).toBe('content/docs/.navigation.yml')
  })

  it('throws on anything that can leave the folder', () => {
    for (const bad of ['', '..', 'a/../b', '/a', 'a//b', 'a/', 'a\\b', 'c:x', 'C:/x', '%2e%2e/x', './a', 'a\n']) {
      expect(() => typeRelativePath('content/docs', bad), bad).toThrow()
    }
    expect(() => typeRelativePath('content/docs', 'x'.repeat(256))).toThrow()
  })
})
