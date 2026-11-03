import type { H3Event } from 'h3'
import type { PlutoGithubAccess } from '../modules/pluto-github/runtime/server/adapter'
import type { GithubFetch } from '../modules/pluto-github/runtime/server/github/client'
import type { PlutoGithubStore } from '../modules/pluto-github/runtime/server/store/types'
import type { PlutoContentType } from '../shared/types/content'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createMarkdownContentAdapter } from '../modules/pluto-github/runtime/server/adapter'
import { createFsStore } from '../modules/pluto-github/runtime/server/store/fs'
import { createGithubStore } from '../modules/pluto-github/runtime/server/store/github'
import { createMemoryStore } from '../modules/pluto-github/runtime/server/store/memory'
import {
  createSnapshotStore,
  withSnapshotFallback,
} from '../modules/pluto-github/runtime/server/store/snapshot'
import { createGithubCache } from '../modules/pluto-github/runtime/server/utils/github-cache'
import { plutoGithubPostType } from '../modules/pluto-github/runtime/shared/post-type'

const type = plutoGithubPostType
const event = {} as H3Event
const EDITOR = ['posts:read_drafts', 'posts:publish', 'posts:delete']

function adapterFor(
  store: PlutoGithubStore,
  access: () => PlutoGithubAccess | null = () => ({
    capabilities: EDITOR,
    auth: { token: 't' },
  })
) {
  return createMarkdownContentAdapter({
    store,
    dir: 'content',
    getAccess: async () => access(),
  })
}

describe('markdown adapter revisions (memory store)', () => {
  async function seeded() {
    const store = createMemoryStore()
    const adapter = adapterFor(store)
    const ctx = { event, type }
    const created = await adapter.create(ctx, {
      title: 'First',
      content: 'One',
    })
    const v2 = await adapter.update(ctx, created.id, {
      title: 'Second',
      _version: created._version,
    })
    await adapter.update(ctx, created.id, {
      status: 'published',
      _version: v2._version,
    })
    return { store, adapter, ctx, id: created.id }
  }

  it('lists the commits of the item, newest first, with their action', async () => {
    const { adapter, ctx, id } = await seeded()
    const page = await adapter.listRevisions!(ctx, id, { limit: 10 })

    expect(page.data.map((revision) => revision.action)).toEqual([
      'publish',
      'update',
      'create',
    ])
    expect(page.data[0]).toMatchObject({
      id: 'c3',
      author: { name: 'Memory' },
    })
    expect(page.nextCursor).toBeUndefined()
  })

  it('pages with a cursor', async () => {
    const { adapter, ctx, id } = await seeded()
    const first = await adapter.listRevisions!(ctx, id, { limit: 2 })
    expect(first.data.map((revision) => revision.id)).toEqual(['c3', 'c2'])
    expect(first.nextCursor).toBe('2')

    const next = await adapter.listRevisions!(ctx, id, {
      limit: 2,
      cursor: first.nextCursor,
    })
    expect(next.data.map((revision) => revision.id)).toEqual(['c1'])
    expect(next.nextCursor).toBeUndefined()
  })

  it('gets the item as it was at a revision', async () => {
    const { adapter, ctx, id } = await seeded()
    const old = await adapter.getRevision!(ctx, id, 'c1')

    expect(old).toMatchObject({ title: 'First', content: 'One', status: 'draft' })
    expect(await adapter.getRevision!(ctx, id, 'nope')).toBeNull()
  })

  it('keeps a message that Pluto did not write, without the skip marker', async () => {
    const store = createMemoryStore()
    await store.commit(
      {
        expectedHeadOid: await store.head(),
        message: 'Fix a typo [skip ci]',
        additions: [
          {
            path: 'content/posts/hand.md',
            contents: '---\ntitle: Hand\n---\nBody\n',
          },
        ],
        deletions: [],
      },
      { token: 't' }
    )
    const page = await adapterFor(store).listRevisions!(
      { event, type },
      'hand',
      { limit: 5 }
    )
    expect(page.data).toEqual([
      {
        id: 'c1',
        createdAt: '2026-01-01T00:00:00.000Z',
        author: { name: 'Memory' },
        message: 'Fix a typo',
      },
    ])
  })

  it('needs a signed-in editor', async () => {
    const { store, id } = await seeded()
    const ctx = { event, type }

    await expect(
      adapterFor(store, () => null).listRevisions!(ctx, id, { limit: 5 })
    ).rejects.toMatchObject({ statusCode: 401 })
    await expect(
      adapterFor(store, () => ({
        capabilities: ['posts:read_drafts'],
        auth: { token: 't' },
      })).getRevision!(ctx, id, 'c1')
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('hides a draft revision from an editor who cannot read drafts', async () => {
    const { store, id } = await seeded()
    const publisher = adapterFor(store, () => ({
      capabilities: ['posts:publish'],
      auth: { token: 't' },
    }))
    const ctx = { event, type }

    expect(await publisher.getRevision!(ctx, id, 'c1')).toBeNull()
    expect(await publisher.getRevision!(ctx, id, 'c3')).toMatchObject({
      status: 'published',
    })
  })

  it('reads a nested id', async () => {
    const docs: PlutoContentType = {
      name: 'doc',
      label: 'Doc',
      labelPlural: 'Docs',
      source: 'docs',
      titleField: 'title',
      fields: [
        { name: 'title', type: 'text', label: 'Title', required: true },
        { name: 'slug', type: 'slug', label: 'Slug' },
        { name: 'body', type: 'richtext', label: 'Body' },
      ],
      slug: { field: 'slug' },
      files: { nested: true },
      capabilities: { write: 'posts:publish' },
    }
    const adapter = adapterFor(createMemoryStore())
    const ctx = { event, type: docs }
    await adapter.create(ctx, { title: 'Install', slug: '1.start/2.install' })

    const page = await adapter.listRevisions!(ctx, '1.start/2.install', {
      limit: 5,
    })
    expect(page.data.map((revision) => revision.action)).toEqual(['create'])
    expect(
      await adapter.getRevision!(ctx, '1.start/2.install', page.data[0]!.id)
    ).toMatchObject({ title: 'Install' })
  })

  it('has no revisions over a store without history', async () => {
    const snapshot = createSnapshotStore(async () => ({
      'content/posts/a.md': '---\ntitle: A\n---\n',
    }))
    const adapter = adapterFor(snapshot)
    const ctx = { event, type }
    expect(await adapter.listRevisions!(ctx, 'a', { limit: 5 })).toEqual({
      data: [],
    })
    expect(await adapter.getRevision!(ctx, 'a', 'c1')).toBeNull()
  })

  it('reads the history through the snapshot fallback, from GitHub', async () => {
    const github = createMemoryStore()
    const adapter = adapterFor(
      withSnapshotFallback(
        github,
        createSnapshotStore(async () => ({}))
      )
    )
    const ctx = { event, type }
    const created = await adapter.create(ctx, { title: 'Live' })

    const page = await adapter.listRevisions!(ctx, created.id, { limit: 5 })
    expect(page.data.map((revision) => revision.id)).toEqual(['c1'])
  })
})

describe('github store history', () => {
  function storeWith(answer: (body: Record<string, unknown>) => unknown) {
    const bodies: Record<string, unknown>[] = []
    const fetch: GithubFetch = async (_url, init) => {
      const body = JSON.parse(init.body ?? '{}') as Record<string, unknown>
      bodies.push(body)
      return {
        status: 200,
        headers: { get: () => null },
        data: { data: answer(body) },
      }
    }
    const store = createGithubStore({
      repo: 'acme/site',
      branch: 'main',
      apiUrl: 'https://api.github.com',
      cache: createGithubCache({ headTtl: 60 }),
      fetch,
    })
    return { store, bodies }
  }

  it('reads the commits of a path on the branch, with the author', async () => {
    const { store, bodies } = storeWith(() => ({
      repository: {
        object: {
          history: {
            pageInfo: { hasNextPage: true, endCursor: 'cur' },
            nodes: [
              {
                oid: 'abc',
                messageHeadline: 'content(post): update "a" [skip ci]',
                committedDate: '2026-11-01T10:00:00Z',
                author: {
                  name: 'Ada',
                  user: { login: 'ada', avatarUrl: 'https://x/a.png' },
                },
              },
              {
                oid: 'def',
                messageHeadline: 'init',
                committedDate: '2026-10-01T10:00:00Z',
                author: { name: 'Bot', user: null },
              },
            ],
          },
        },
      },
    }))

    const page = await store.history!(
      'content/posts/a.md',
      { limit: 2, cursor: 'c0' },
      { token: 'user' }
    )

    expect(bodies[0]!.variables).toEqual({
      owner: 'acme',
      name: 'site',
      branch: 'main',
      path: 'content/posts/a.md',
      first: 2,
      after: 'c0',
    })
    expect(page).toEqual({
      commits: [
        {
          oid: 'abc',
          message: 'content(post): update "a" [skip ci]',
          committedAt: '2026-11-01T10:00:00Z',
          author: {
            name: 'Ada',
            login: 'ada',
            avatarUrl: 'https://x/a.png',
          },
        },
        {
          oid: 'def',
          message: 'init',
          committedAt: '2026-10-01T10:00:00Z',
          author: { name: 'Bot' },
        },
      ],
      nextCursor: 'cur',
    })
  })

  it('reads a file at a commit', async () => {
    const { store, bodies } = storeWith(() => ({
      repository: {
        object: {
          oid: 'blob1',
          text: 'old text',
          byteSize: 8,
          isBinary: false,
          isTruncated: false,
        },
      },
    }))

    expect(await store.readAt!('content/posts/a.md', 'abc')).toEqual({
      path: 'content/posts/a.md',
      name: 'a.md',
      oid: 'blob1',
      text: 'old text',
    })
    expect(bodies[0]!.variables).toMatchObject({
      expression: 'abc:content/posts/a.md',
    })
  })
})

describe('fs store history', { timeout: 30000 }, () => {
  let root = ''
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()

  it('reads the local Git log of a file and the file at a commit', async () => {
    root = mkdtempSync(join(tmpdir(), 'pluto-revisions-'))
    git('init', '-q')
    git('config', 'user.name', 'Test')
    git('config', 'user.email', 'test@example.com')
    git('config', 'commit.gpgsign', 'false')
    const store = createFsStore({
      root,
      headDir: 'content',
      gitCommit: true,
    })
    const adapter = adapterFor(store)
    const ctx = { event, type }
    const created = await adapter.create(ctx, { title: 'One' })
    await adapter.update(ctx, created.id, {
      title: 'Two',
      _version: created._version,
    })

    const page = await adapter.listRevisions!(ctx, created.id, { limit: 1 })
    expect(page.data).toHaveLength(1)
    expect(page.data[0]).toMatchObject({
      action: 'update',
      author: { name: 'Test' },
    })
    expect(page.nextCursor).toBe('1')

    const older = await adapter.listRevisions!(ctx, created.id, {
      limit: 5,
      cursor: page.nextCursor,
    })
    expect(older.data.map((revision) => revision.action)).toEqual(['create'])
    expect(
      await adapter.getRevision!(ctx, created.id, older.data[0]!.id)
    ).toMatchObject({ title: 'One' })
    expect(await adapter.getRevision!(ctx, created.id, '--help')).toBeNull()
  })

  it('has no history outside a Git repo', async () => {
    root = mkdtempSync(join(tmpdir(), 'pluto-revisions-'))
    writeFileSync(join(root, 'x'), '')
    const store = createFsStore({ root, headDir: 'content' })
    expect(
      await store.history!('content/posts/a.md', { limit: 5 })
    ).toEqual({ commits: [] })
  })
})
