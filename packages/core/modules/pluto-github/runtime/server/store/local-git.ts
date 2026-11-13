import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

export type LocalCommitResult =
  | { committed: true; sha: string }
  | { committed: false; skipped: 'not-a-repo' | 'no-git' | 'no-changes' }

async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await run('git', args, { cwd: root, windowsHide: true })
  return stdout.trim()
}

export async function commitLocalFiles(
  root: string,
  paths: string[],
  message: string
): Promise<LocalCommitResult> {
  try {
    if ((await git(root, ['rev-parse', '--is-inside-work-tree'])) !== 'true') {
      return { committed: false, skipped: 'not-a-repo' }
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    return {
      committed: false,
      skipped: code === 'ENOENT' ? 'no-git' : 'not-a-repo',
    }
  }

  // Stage a path that is on disk (new or changed) or that Git tracks (a deletion). A deleted path
  // that Git never tracked has nothing to stage, and `git add` would fail on it. `--` ends the
  // options, so a path can never act as one.
  const tracked = new Set(
    (await git(root, ['ls-files', '--', ...paths])).split('\n').filter(Boolean)
  )
  const stageable = paths.filter(
    (path) => existsSync(join(root, path)) || tracked.has(path)
  )
  if (stageable.length === 0) {
    return { committed: false, skipped: 'no-changes' }
  }
  await git(root, ['add', '-A', '--', ...stageable])
  const staged = (
    await git(root, [
      'diff',
      '--cached',
      '--name-only',
      '--relative',
      '--',
      ...stageable,
    ])
  )
    .split('\n')
    .filter(Boolean)
  if (staged.length === 0) {
    return { committed: false, skipped: 'no-changes' }
  }

  await git(root, ['commit', '-m', message, '--', ...staged])
  return { committed: true, sha: await git(root, ['rev-parse', 'HEAD']) }
}

export type LocalGitStatus =
  | { repo: false; reason: 'not-a-repo' | 'no-git' }
  | {
      repo: true
      branch: string | null
      upstream: string | null
      remote: string | null
      ahead: number
    }

export type LocalPushError =
  | 'not-a-repo'
  | 'detached'
  | 'no-remote'
  | 'rejected'
  | 'auth'
  | 'timeout'
  | 'failed'

export class LocalPushFailure extends Error {
  constructor(readonly reason: LocalPushError) {
    super(`git push failed: ${reason}`)
  }
}

async function gitOrNull(root: string, args: string[]): Promise<string | null> {
  try {
    return await git(root, args)
  } catch {
    return null
  }
}

export async function readLocalGitStatus(
  root: string
): Promise<LocalGitStatus> {
  try {
    if ((await git(root, ['rev-parse', '--is-inside-work-tree'])) !== 'true') {
      return { repo: false, reason: 'not-a-repo' }
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    return { repo: false, reason: code === 'ENOENT' ? 'no-git' : 'not-a-repo' }
  }

  const branch =
    (await gitOrNull(root, ['symbolic-ref', '--short', '-q', 'HEAD'])) || null
  const upstream =
    (await gitOrNull(root, [
      'rev-parse',
      '--abbrev-ref',
      '--symbolic-full-name',
      '@{u}',
    ])) || null
  const remotes = ((await gitOrNull(root, ['remote'])) ?? '')
    .split('\n')
    .filter(Boolean)
  const upstreamRemote = upstream
    ? remotes.find((name) => upstream.startsWith(`${name}/`))
    : undefined
  const remote =
    upstreamRemote ??
    (remotes.includes('origin') ? 'origin' : (remotes[0] ?? null))

  const count = await gitOrNull(
    root,
    upstream
      ? ['rev-list', '--count', '@{u}..HEAD']
      : ['rev-list', '--count', 'HEAD', '--not', '--remotes']
  )
  const ahead = Math.max(0, Number.parseInt(count ?? '0', 10) || 0)

  return { repo: true, branch, upstream, remote, ahead }
}

export function pushErrorReason(stderr: string): LocalPushError {
  if (/\[rejected\]|non-fast-forward|fetch first/i.test(stderr)) {
    return 'rejected'
  }
  if (
    /authentication failed|could not read username|permission denied|terminal prompts disabled|error: 403|returned error: 403/i.test(
      stderr
    )
  ) {
    return 'auth'
  }
  return 'failed'
}

export async function pushLocalGit(
  root: string,
  options: { timeout?: number } = {}
): Promise<LocalGitStatus> {
  const status = await readLocalGitStatus(root)
  if (!status.repo) {
    throw new LocalPushFailure('not-a-repo')
  }
  if (!status.branch) {
    throw new LocalPushFailure('detached')
  }
  if (!status.remote) {
    throw new LocalPushFailure('no-remote')
  }

  const args = status.upstream
    ? ['push']
    : ['push', '--set-upstream', '--', status.remote, status.branch]
  try {
    await run('git', args, {
      cwd: root,
      windowsHide: true,
      timeout: options.timeout ?? 120_000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    })
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & {
      killed?: boolean
      signal?: string | null
      stderr?: string
    }
    if (failure.killed || failure.signal === 'SIGTERM') {
      throw new LocalPushFailure('timeout')
    }
    throw new LocalPushFailure(pushErrorReason(String(failure.stderr ?? '')))
  }

  return readLocalGitStatus(root)
}

export interface LocalFileCommit {
  oid: string
  message: string
  committedAt: string
  authorName: string
}

const FIELD = '\u001F'
const RECORD = '\u001E'
const COMMIT_OID = /^[0-9a-f]{7,64}$/i

export async function localFileHistory(
  root: string,
  path: string,
  query: {
    limit: number
    skip: number
  }
): Promise<{
  commits: LocalFileCommit[]
  more: boolean
}> {
  let out: string
  try {
    out = await git(root, [
      'log',
      `-n${query.limit + 1}`,
      `--skip=${query.skip}`,
      `--format=%H${FIELD}%cI${FIELD}%an${FIELD}%s${RECORD}`,
      '--',
      path,
    ])
  } catch {
    return { commits: [], more: false }
  }
  const commits = out
    .split(RECORD)
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [oid = '', committedAt = '', authorName = '', message = ''] =
        record.split(FIELD)
      return { oid, committedAt, authorName, message }
    })
  return {
    commits: commits.slice(0, query.limit),
    more: commits.length > query.limit,
  }
}

export async function localFileAt(
  root: string,
  path: string,
  commitOid: string
): Promise<string | null> {
  if (!COMMIT_OID.test(commitOid)) {
    return null
  }
  try {
    const { stdout } = await run('git', ['show', `${commitOid}:./${path}`], {
      cwd: root,
      windowsHide: true,
      maxBuffer: 32 * 1024 * 1024,
    })
    return stdout
  } catch {
    return null
  }
}
