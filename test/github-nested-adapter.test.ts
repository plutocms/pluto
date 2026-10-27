import type { H3Event } from 'h3'
import type { PlutoGithubAccess } from '../modules/pluto-github/runtime/server/adapter'
import type { PlutoGithubStore } from '../modules/pluto-github/runtime/server/store/types'
import type { PlutoContentType } from '../shared/types/content'
import type { ContractCaller, ContractHarness } from './contracts/content-adapter.contract'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createMarkdownContentAdapter } from '../modules/pluto-github/runtime/server/adapter'
import { createFsStore } from '../modules/pluto-github/runtime/server/store/fs'
import { createGithubStore } from '../modules/pluto-github/runtime/server/store/github'
import { createMemoryStore } from '../modules/pluto-github/runtime/server/store/memory'
import { createGithubCache } from '../modules/pluto-github/runtime/server/utils/github-cache'
import { parseMarkdownFile } from '../modules/pluto-github/runtime/server/utils/markdown-file'
import { plutoGithubPostType } from '../modules/pluto-github/runtime/shared/post-type'
import { createContractClock, runContentAdapterContract } from './contracts/content-adapter.contract'
import { createFakeGithub } from './fixtures/fake-github'
import { nestedType } from './fixtures/nested-type'

const event = {} as H3Event
const EDITOR = ['posts:read_drafts', 'posts:publish', 'posts:delete']

function harnessFor(store: PlutoGithubStore, clock: () => Date) {
  let caller: ContractCaller = { capabilities: EDITOR }
  const adapter = createMarkdownContentAdapter({
    store,
    dir: 'content',
    now: clock,
    getAccess: async (): Promise<PlutoGithubAccess | null> => caller ? { capabilities: caller.capabilities, auth: { token: 't' } } : null,
  })
  const harness: ContractHarness = {
    adapter,
    as: (next) => {
      caller = next
    },
  }
  return harness
}

function githubStore(files: Record<string, string> = {}) {
  const github = createFakeGithub({ files })
  const store = createGithubStore({
    repo: github.repo,
    branch: github.branch,
    apiUrl: 'https://api.github.com',
    cache: createGithubCache({ headTtl: 60 }),
    fetch: github.fetch,
  })
  return { github, store }
}

function page(title: string, extra = '', body = 'Text'): string {
  return `---\ntitle: ${title}\nstatus: published\n${extra}---\n${body}\n`
}

const docs: Record<string, string> = {
  'content/docs/index.md': page('Home'),
  'content/docs/10.last.md': page('Last'),
  'content/docs/2.second/index.md': page('Second'),
  'content/docs/2.second/2.b.md': page('B'),
  'content/docs/2.second/1.a.md': page('A'),
  'content/docs/1.first.md': page('First'),
  'content/docs/zeta.md': page('Zeta'),
  'content/docs/Bad Name.md': page('Skipped'),
  'content/docs/.hidden/x.md': page('Hidden'),
  'content/other/y.md': page('Other type'),
}

const treeOrder = ['index', '1.first', '2.second/index', '2.second/1.a', '2.second/2.b', '10.last', 'zeta']

function setup(type: PlutoContentType = nestedType, files: Record<string, string> = docs) {
  const { github, store } = githubStore(files)
  const harness = harnessFor(store, createContractClock())
  const ctx = { event, type }
  const ids = async (query = {}) => (await harness.adapter.list(ctx, { includeUnpublished: true, ...query })).data.map((item) => item.id)
  return { github, store, harness, adapter: harness.adapter, ctx, ids }
}

runContentAdapterContract('nested markdown over the memory store', async (clock) => harnessFor(createMemoryStore(), clock), { type: nestedType })
runContentAdapterContract('nested markdown over the github store', async (clock) => harnessFor(githubStore().store, clock), { type: nestedType })

describe('nested markdown adapter', () => {
  it('lists every nested file with its path as id, in tree order', async () => {
    const { ids } = setup()

    expect(await ids()).toEqual(treeOrder)
  })

  it('sorts descending when asked', async () => {
    const { ids } = setup()

    expect((await ids({ sort: { field: 'id', direction: 'desc' } }))[0]).toBe('zeta')
  })

  it('gets a nested item by path', async () => {
    const { adapter, ctx } = setup()

    expect(await adapter.get(ctx, '2.second/1.a')).toMatchObject({ id: '2.second/1.a', slug: '2.second/1.a', title: 'A' })
    expect(await adapter.get(ctx, '2.second/missing')).toBeNull()
  })

  it('returns null for an unsafe id', async () => {
    const { adapter, ctx } = setup()

    for (const id of ['../x', 'a/../index', '2.second//1.a', '.hidden/x', 'Bad Name', '']) {
      expect(await adapter.get(ctx, id), id).toBeNull()
    }
  })

  it('answers 404 to update and remove with an unsafe id', async () => {
    const { adapter, ctx } = setup()

    await expect(adapter.update(ctx, '../index', { title: 'x' })).rejects.toMatchObject({ statusCode: 404 })
    await expect(adapter.remove(ctx, 'a/../index')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('hides the excluded ids and folders', async () => {
    const type = { ...nestedType, files: { nested: true, exclude: ['index', '2.second/'] } }
    const { ids, adapter, ctx } = setup(type)

    expect(await ids()).toEqual(['1.first', '10.last', 'zeta'])
    expect(await adapter.get(ctx, 'index')).toBeNull()
    expect(await adapter.get(ctx, '2.second/1.a')).toBeNull()
    await expect(adapter.update(ctx, 'index', { title: 'x' })).rejects.toMatchObject({ statusCode: 404 })
    await expect(adapter.create(ctx, { title: 'T', slug: '2.second/new' })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('uses the content dir itself for an empty source', async () => {
    const type = { ...nestedType, source: '' }
    const { ids, adapter, ctx, github } = setup(type, { 'content/index.md': page('Home'), 'content/1.a/b.md': page('B') })

    expect(await ids()).toEqual(['index', '1.a/b'])
    await adapter.create(ctx, { title: 'New', slug: '1.a/new' })
    expect(github.read('content/1.a/new.md')).toBeDefined()
  })

  it('creates an item in a folder', async () => {
    const { adapter, ctx, github } = setup()

    const created = await adapter.create(ctx, { title: 'Intro', slug: '3.new-folder/1.intro', content: 'Hi' })

    expect(created).toMatchObject({ id: '3.new-folder/1.intro', slug: '3.new-folder/1.intro', status: 'draft' })
    const parsed = parseMarkdownFile(github.read('content/docs/3.new-folder/1.intro.md')!)
    expect(parsed.frontmatter.title).toBe('Intro')
    expect(parsed.frontmatter.slug).toBeUndefined()
    expect(parsed.body).toBe('Hi')
  })

  it('creates an item at the root from the title', async () => {
    const { adapter, ctx, github } = setup()

    expect((await adapter.create(ctx, { title: 'Hello World' })).id).toBe('hello-world')
    expect(github.read('content/docs/hello-world.md')).toBeDefined()
  })

  it('refuses a bad path and a taken path on create', async () => {
    const { adapter, ctx } = setup()

    await expect(adapter.create(ctx, { title: 'T', slug: 'a/../b' })).rejects.toMatchObject({ statusCode: 400 })
    await expect(adapter.create(ctx, { title: 'T', slug: 'a/b/c/d/e/f/g' })).rejects.toMatchObject({ statusCode: 400 })
    await expect(adapter.create(ctx, { title: 'T', slug: '2.second/1.a' })).rejects.toMatchObject({ statusCode: 409 })
  })

  it('moves an item to another folder in one commit', async () => {
    const { adapter, ctx, github } = setup()
    const before = github.calls.commit

    const moved = await adapter.update(ctx, '2.second/1.a', { slug: '5.other/1.a', title: 'A moved' })

    expect(moved).toMatchObject({ id: '5.other/1.a', title: 'A moved' })
    expect(github.calls.commit).toBe(before + 1)
    expect(github.read('content/docs/2.second/1.a.md')).toBeUndefined()
    expect(parseMarkdownFile(github.read('content/docs/5.other/1.a.md')!).frontmatter.title).toBe('A moved')
    expect(await adapter.get(ctx, '2.second/1.a')).toBeNull()
  })

  it('refuses a move onto an existing file', async () => {
    const { adapter, ctx } = setup()

    await expect(adapter.update(ctx, '2.second/1.a', { slug: '2.second/2.b' })).rejects.toMatchObject({ statusCode: 409 })
  })

  it('removes a nested item', async () => {
    const { adapter, ctx, github } = setup()

    await adapter.remove(ctx, '2.second/2.b')

    expect(github.read('content/docs/2.second/2.b.md')).toBeUndefined()
    await expect(adapter.remove(ctx, '2.second/2.b')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('works over the memory store', async () => {
    const memory = harnessFor(createMemoryStore(docs), createContractClock())
    const ctx = { event, type: nestedType }

    expect((await memory.adapter.get(ctx, '2.second/1.a'))?.title).toBe('A')
    await memory.adapter.update(ctx, '2.second/1.a', { slug: '9.moved/a' })
    expect(await memory.adapter.get(ctx, '9.moved/a')).toMatchObject({ title: 'A' })
  })

  it('works over the fs store', async () => {
    const ctx = { event, type: nestedType }
    const root = await mkdtemp(join(tmpdir(), 'pluto-nested-'))
    try {
      const store = createFsStore({ root })
      await store.commit({
        expectedHeadOid: await store.head(),
        message: 'seed',
        additions: Object.entries(docs).map(([path, contents]) => ({ path, contents })),
        deletions: [],
      }, { token: 't' })
      const { adapter } = harnessFor(store, createContractClock())

      expect((await adapter.list(ctx, { includeUnpublished: true })).data.map((item) => item.id)).toEqual(treeOrder)
      await adapter.update(ctx, '2.second/1.a', { slug: '3.deep/er/a' })
      expect((await adapter.get(ctx, '3.deep/er/a'))?.title).toBe('A')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

describe('frontmatter hooks', () => {
  const hooked: PlutoContentType = {
    ...nestedType,
    fields: [
      ...nestedType.fields,
      { name: 'navTitle', type: 'text', label: 'Nav title', column: 'navTitle' },
    ],
    files: {
      nested: true,
      frontmatter: {
        read: (frontmatter) => {
          const navigation = frontmatter.navigation as {
 title?: string
} | undefined
          return navigation?.title === undefined ? frontmatter : { ...frontmatter, navTitle: navigation.title }
        },
        write: (frontmatter) => {
          const { navTitle, ...rest } = frontmatter
          if (navTitle === undefined || navTitle === '') {
            return rest
          }
          return { ...rest, navigation: { ...(rest.navigation as object | undefined), title: navTitle } }
        },
      },
    },
  }

  it('maps the frontmatter on read', async () => {
    const { adapter, ctx } = setup(hooked, { 'content/docs/a.md': page('A', 'navigation:\n  title: Short\n  icon: x\n') })

    expect(await adapter.get(ctx, 'a')).toMatchObject({ title: 'A', navTitle: 'Short' })
  })

  it('maps the frontmatter on write and keeps the unknown keys', async () => {
    const { adapter, ctx, github } = setup(hooked, { 'content/docs/a.md': page('A', 'navigation:\n  title: Short\n  icon: x\n') })

    await adapter.update(ctx, 'a', { navTitle: 'Long' })
    const parsed = parseMarkdownFile(github.read('content/docs/a.md')!)

    expect(parsed.frontmatter.navigation).toEqual({ title: 'Long', icon: 'x' })
    expect(parsed.frontmatter.navTitle).toBeUndefined()

    await adapter.create(ctx, { title: 'B', navTitle: 'Bee' })
    expect(parseMarkdownFile(github.read('content/docs/b.md')!).frontmatter.navigation).toEqual({ title: 'Bee' })
  })
})

describe('no commit when the file text is unchanged', () => {
  const stable = '---\ntitle: A\nstatus: published\npublishedAt: 2026-01-01T00:00:00.000Z\ncreatedAt: 2026-01-01T00:00:00.000Z\nupdatedAt: 2026-01-02T00:00:00.000Z\n---\nText\n'

  const cases: [string, PlutoContentType, string][] = [
    ['nested', nestedType, 'content/docs/a.md'],
    ['flat', plutoGithubPostType, 'content/posts/a.md'],
  ]

  for (const [label, type, path] of cases) {
    it(`skips the commit for a ${label} type, and keeps the version and the updated stamp`, async () => {
      const { adapter, ctx, github } = setup(type, { [path]: stable })
      const first = await adapter.get(ctx, 'a')
      const commits = github.calls.commit

      const saved = await adapter.update(ctx, 'a', { title: 'A', content: 'Text\n', _version: first!._version })

      expect(github.calls.commit).toBe(commits)
      expect(saved._version).toBe(first!._version)
      expect(saved.updatedAt).toBe('2026-01-02T00:00:00.000Z')
      expect(github.read(path)).toBe(stable)
    })

    it(`commits for a ${label} type when a value changes`, async () => {
      const { adapter, ctx, github } = setup(type, { [path]: stable })
      const commits = github.calls.commit

      await adapter.update(ctx, 'a', { title: 'B' })

      expect(github.calls.commit).toBe(commits + 1)
      expect(github.read(path)).toContain('title: B')
    })
  }

  it('still checks the version of a no-op save', async () => {
    const { adapter, ctx } = setup(nestedType, { 'content/docs/a.md': stable })

    await expect(adapter.update(ctx, 'a', { title: 'A', _version: 'stale' })).rejects.toMatchObject({ statusCode: 409 })
  })
})
