import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFsStore } from '../modules/pluto-github/runtime/server/store/fs'
import { commitLocalFiles } from '../modules/pluto-github/runtime/server/store/local-git'

let root: string
// The fs store ignores the token.
const auth = { token: '' }

const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()

function initRepo() {
  git('init', '-q')
  git('config', 'user.name', 'Test')
  git('config', 'user.email', 'test@example.com')
  git('config', 'commit.gpgsign', 'false')
  writeFileSync(join(root, 'README.md'), 'readme\n')
  git('add', 'README.md')
  git('commit', '-q', '-m', 'init')
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'pluto-local-git-'))
})

afterEach(() => {
  vi.restoreAllMocks()
  rmSync(root, { recursive: true, force: true })
})

describe('commitLocalFiles', { timeout: 30000 }, () => {
  it('skips a folder that is not a Git repo', async () => {
    writeFileSync(join(root, 'a.md'), 'a')
    expect(await commitLocalFiles(root, ['a.md'], 'msg')).toEqual({
      committed: false,
      skipped: 'not-a-repo',
    })
  })

  it('commits only the given paths and leaves other staged changes alone', async () => {
    initRepo()
    writeFileSync(join(root, 'other.md'), 'staged by the author')
    git('add', 'other.md')
    writeFileSync(join(root, 'post.md'), 'from the admin')

    const result = await commitLocalFiles(
      root,
      ['post.md'],
      'content(post): create'
    )

    expect(result.committed).toBe(true)
    expect(git('log', '-1', '--format=%s')).toBe('content(post): create')
    expect(git('show', '--name-only', '--format=', 'HEAD')).toBe('post.md')
    // The author's own staged file is still staged, and not committed.
    expect(git('diff', '--cached', '--name-only')).toBe('other.md')
  })

  it('commits a deletion, and skips a path with no change', async () => {
    initRepo()
    expect(await commitLocalFiles(root, ['README.md'], 'msg')).toEqual({
      committed: false,
      skipped: 'no-changes',
    })
    rmSync(join(root, 'README.md'))
    const result = await commitLocalFiles(
      root,
      ['README.md', 'never-tracked.md'],
      'content(post): delete'
    )
    expect(result.committed).toBe(true)
    expect(git('ls-files')).toBe('')
  })
})

describe('fs store with gitCommit', { timeout: 30000 }, () => {
  it('writes the file and commits it, without the skip-deploy marker', async () => {
    initRepo()
    const store = createFsStore({ root, headDir: 'content', gitCommit: true })
    const head = await store.head()

    await store.commit(
      {
        expectedHeadOid: head,
        message: 'content(post): create hello [skip ci]',
        additions: [{ path: 'content/posts/hello.md', contents: '# Hello\n' }],
        deletions: [],
      },
      auth
    )

    expect(git('log', '-1', '--format=%s')).toBe('content(post): create hello')
    expect(git('show', '--name-only', '--format=', 'HEAD')).toBe(
      'content/posts/hello.md'
    )
  })

  it('still saves the file when the folder is not a Git repo', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const store = createFsStore({ root, headDir: 'content', gitCommit: true })

    await store.commit(
      {
        expectedHeadOid: await store.head(),
        message: 'content(post): create',
        additions: [{ path: 'content/posts/a.md', contents: 'a' }],
        deletions: [],
      },
      auth
    )

    expect(
      (await store.readFile('content/posts/a.md', await store.head()))?.text
    ).toBe('a')
    expect(warn.mock.calls.length).toBeLessThanOrEqual(1)
  })

  it('does not commit without gitCommit', async () => {
    initRepo()
    const store = createFsStore({ root, headDir: 'content' })
    await store.commit(
      {
        expectedHeadOid: await store.head(),
        message: 'content(post): create',
        additions: [{ path: 'content/posts/a.md', contents: 'a' }],
        deletions: [],
      },
      auth
    )
    expect(git('log', '-1', '--format=%s')).toBe('init')
  })
})
