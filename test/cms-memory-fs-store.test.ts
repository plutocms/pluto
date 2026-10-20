import type { PlutoCmsStore } from '../modules/pluto-cms/runtime/server/store/types'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createFsStore } from '../modules/pluto-cms/runtime/server/store/fs'
import { createMemoryStore } from '../modules/pluto-cms/runtime/server/store/memory'
import { PlutoCmsConflictError } from '../modules/pluto-cms/runtime/server/store/types'

const auth = { token: 'unused' }

const cleanups: string[] = []
afterEach(async () => {
  for (const dir of cleanups.splice(0)) {
    await rm(dir, { recursive: true, force: true })
  }
})

// The same behavior for the memory and the fs store.
function contract(label: string, make: () => Promise<PlutoCmsStore>) {
  describe(`${label} store`, () => {
    it('lists the .md files of a dir, sorted, and skips other files', async () => {
      const store = await make()
      const head = await store.head()
      await store.commit({
        expectedHeadOid: head,
        message: 'seed',
        additions: [
          { path: 'content/posts/b.md', contents: 'B' },
          { path: 'content/posts/a.md', contents: 'A' },
          { path: 'content/posts/note.txt', contents: 'T' },
          { path: 'content/posts/sub/c.md', contents: 'C' },
        ],
        deletions: [],
      }, auth)

      const files = await store.listDir('content/posts', await store.head())

      expect(files.map((file) => file.name)).toEqual(['a.md', 'b.md'])
      expect(files[0]).toMatchObject({ path: 'content/posts/a.md', text: 'A' })
    })

    it('gives an empty list for a missing dir and null for a missing file', async () => {
      const store = await make()
      const head = await store.head()

      expect(await store.listDir('content/none', head)).toEqual([])
      expect(await store.readFile('content/none/x.md', head)).toBeNull()
    })

    it('changes the head after a commit and applies deletions', async () => {
      const store = await make()
      const first = await store.head()
      const { oid } = await store.commit({
        expectedHeadOid: first,
        message: 'add',
        additions: [{ path: 'content/posts/a.md', contents: 'A' }],
        deletions: [],
      }, auth)

      expect(oid).not.toBe(first)
      expect(await store.head()).toBe(oid)
      expect((await store.readFile('content/posts/a.md', oid))?.text).toBe('A')

      const next = await store.commit({
        expectedHeadOid: oid,
        message: 'remove',
        additions: [],
        deletions: [{ path: 'content/posts/a.md' }],
      }, auth)

      expect(await store.readFile('content/posts/a.md', next.oid)).toBeNull()
    })

    it('throws a conflict error for a stale head', async () => {
      const store = await make()
      const first = await store.head()
      await store.commit({
        expectedHeadOid: first,
        message: 'add',
        additions: [{ path: 'content/posts/a.md', contents: 'A' }],
        deletions: [],
      }, auth)

      await expect(store.commit({
        expectedHeadOid: first,
        message: 'late',
        additions: [{ path: 'content/posts/b.md', contents: 'B' }],
        deletions: [],
      }, auth)).rejects.toBeInstanceOf(PlutoCmsConflictError)
      expect(await store.readFile('content/posts/b.md', await store.head())).toBeNull()
    })
  })
}

contract('memory', async () => createMemoryStore())

describe('fs store', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'pluto-cms-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  contract('fs (contract)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pluto-cms-c-'))
    cleanups.push(dir)
    return createFsStore({ root: dir })
  })

  it('treats a missing root as empty', async () => {
    const store = createFsStore({ root: join(root, 'missing') })

    expect(await store.listDir('content', await store.head())).toEqual([])
  })

  it('changes the head when a file changes outside the store', async () => {
    const store = createFsStore({ root })
    const before = await store.head()
    await mkdir(join(root, 'content'), { recursive: true })
    await writeFile(join(root, 'content', 'a.md'), 'A')

    expect(await store.head()).not.toBe(before)
  })

  // The root is the project dir in dev. The head must read the content dir
  // only, never `node_modules` or build output.
  it('makes the head from headDir only', async () => {
    const store = createFsStore({ root, headDir: 'content' })
    await mkdir(join(root, 'content'), { recursive: true })
    await writeFile(join(root, 'content', 'a.md'), 'A')
    const head = await store.head()

    await mkdir(join(root, 'node_modules', 'pkg'), { recursive: true })
    await writeFile(join(root, 'node_modules', 'pkg', 'index.js'), 'x')
    await writeFile(join(root, 'package.json'), '{}')
    expect(await store.head()).toBe(head)

    await writeFile(join(root, 'content', 'b.md'), 'B')
    expect(await store.head()).not.toBe(head)
  })

  it('never reads node_modules or dot dirs for the head', async () => {
    const store = createFsStore({ root })
    const head = await store.head()
    await mkdir(join(root, 'node_modules', 'pkg'), { recursive: true })
    await writeFile(join(root, 'node_modules', 'pkg', 'index.js'), 'x')
    await mkdir(join(root, '.nuxt'), { recursive: true })
    await writeFile(join(root, '.nuxt', 'app.js'), 'x')

    expect(await store.head()).toBe(head)
  })

  it('refuses paths outside the root and changes nothing', async () => {
    const store = createFsStore({ root })
    const head = await store.head()

    for (const path of ['../evil.md', 'content/../../evil.md', '/etc/evil.md', '']) {
      await expect(store.commit({
        expectedHeadOid: head,
        message: 'bad',
        additions: [{ path: 'content/ok.md', contents: 'ok' }, { path, contents: 'x' }],
        deletions: [],
      }, auth), path).rejects.toMatchObject({ code: 'forbidden' })
    }
    expect(await store.readFile('content/ok.md', head)).toBeNull()
    await expect(readFile(join(root, '..', 'evil.md'))).rejects.toThrow()
  })
})
