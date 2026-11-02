import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFsStore } from '../modules/pluto-github/runtime/server/store/fs'
import {
  commitLocalFiles,
  LocalPushFailure,
  pushErrorReason,
  pushLocalGit,
  readLocalGitStatus,
} from '../modules/pluto-github/runtime/server/store/local-git'

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

describe('readLocalGitStatus and pushLocalGit', { timeout: 30000 }, () => {
  let remote: string

  beforeEach(() => {
    remote = mkdtempSync(join(tmpdir(), 'pluto-local-remote-'))
    execFileSync('git', ['init', '-q', '--bare'], { cwd: remote })
  })

  afterEach(() => {
    rmSync(remote, { recursive: true, force: true })
  })

  const commit = (name: string) => {
    writeFileSync(join(root, name), name)
    git('add', name)
    git('commit', '-q', '-m', name)
  }

  it('reads a folder that is not a Git repo', async () => {
    expect(await readLocalGitStatus(root)).toEqual({
      repo: false,
      reason: 'not-a-repo',
    })
  })

  it('counts every commit when the repo has no remote, and refuses to push', async () => {
    initRepo()
    commit('a.md')
    const branch = git('symbolic-ref', '--short', 'HEAD')

    expect(await readLocalGitStatus(root)).toEqual({
      repo: true,
      branch,
      upstream: null,
      remote: null,
      ahead: 2,
    })
    await expect(pushLocalGit(root)).rejects.toMatchObject({
      reason: 'no-remote',
    })
  })

  it('pushes a new branch with an upstream, then counts against the upstream', async () => {
    initRepo()
    git('remote', 'add', 'origin', remote)
    const branch = git('symbolic-ref', '--short', 'HEAD')

    expect((await readLocalGitStatus(root)) as { ahead: number }).toMatchObject(
      {
        upstream: null,
        remote: 'origin',
        ahead: 1,
      }
    )

    expect(await pushLocalGit(root)).toEqual({
      repo: true,
      branch,
      upstream: `origin/${branch}`,
      remote: 'origin',
      ahead: 0,
    })

    commit('b.md')
    commit('c.md')
    expect(await readLocalGitStatus(root)).toMatchObject({ ahead: 2 })
    expect(await pushLocalGit(root)).toMatchObject({ ahead: 0 })
    expect(
      execFileSync('git', ['log', '-1', '--format=%s', branch], {
        cwd: remote,
        encoding: 'utf8',
      }).trim()
    ).toBe('c.md')
  })

  it('reports a rejected push when the remote moved on', async () => {
    initRepo()
    git('remote', 'add', 'origin', remote)
    await pushLocalGit(root)
    const branch = git('symbolic-ref', '--short', 'HEAD')

    // Another clone pushes first.
    const other = mkdtempSync(join(tmpdir(), 'pluto-local-other-'))
    try {
      execFileSync('git', ['clone', '-q', remote, other])
      writeFileSync(join(other, 'x.md'), 'x')
      const run = (...args: string[]) =>
        execFileSync('git', args, { cwd: other })
      run('-c', 'user.name=T', '-c', 'user.email=t@example.com', 'add', 'x.md')
      run(
        '-c',
        'user.name=T',
        '-c',
        'user.email=t@example.com',
        '-c',
        'commit.gpgsign=false',
        'commit',
        '-q',
        '-m',
        'x'
      )
      run('push', '-q', 'origin', branch)
    } finally {
      rmSync(other, { recursive: true, force: true })
    }

    commit('mine.md')
    const error = await pushLocalGit(root).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(LocalPushFailure)
    expect((error as LocalPushFailure).reason).toBe('rejected')
  })

  it('reports a detached HEAD', async () => {
    initRepo()
    git('remote', 'add', 'origin', remote)
    git('checkout', '-q', '--detach')
    expect(await readLocalGitStatus(root)).toMatchObject({ branch: null })
    await expect(pushLocalGit(root)).rejects.toMatchObject({
      reason: 'detached',
    })
  })
})

describe('pushErrorReason', () => {
  it('sorts the stderr of git push', () => {
    expect(
      pushErrorReason(' ! [rejected]        main -> main (fetch first)')
    ).toBe('rejected')
    expect(
      pushErrorReason(
        "fatal: could not read Username for 'https://github.com': terminal prompts disabled"
      )
    ).toBe('auth')
    expect(
      pushErrorReason('git@github.com: Permission denied (publickey).')
    ).toBe('auth')
    expect(
      pushErrorReason('fatal: unable to access: Could not resolve host')
    ).toBe('failed')
  })
})
