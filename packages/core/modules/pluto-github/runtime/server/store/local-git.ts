import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** The result of a local commit. `skipped` names the reason when nothing was committed. */
export type LocalCommitResult =
  | { committed: true; sha: string }
  | { committed: false; skipped: 'not-a-repo' | 'no-git' | 'no-changes' }

async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await run('git', args, { cwd: root, windowsHide: true })
  return stdout.trim()
}

/**
 * Commits the given paths (relative to `root`) to the local Git repo of `root`, and nothing else:
 * changes that the author staged in other files stay as they are. New files are added, deleted
 * files are removed. The commit runs the hooks of the repo and uses its author (`user.name`,
 * `user.email`).
 *
 * Returns `committed: false` without an error when `root` is not in a Git work tree, when Git is
 * not installed, or when the paths have no change. Throws when Git fails (a hook, no author).
 */
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

  // `--only` (implied by the paths) commits these files and leaves the rest of the index alone.
  await git(root, ['commit', '-m', message, '--', ...staged])
  return { committed: true, sha: await git(root, ['rev-parse', 'HEAD']) }
}

/** The state of the local Git repo, for the backend badge of the admin (local mode). */
export type LocalGitStatus =
  | { repo: false; reason: 'not-a-repo' | 'no-git' }
  | {
      repo: true
      /** The current branch. `null` on a detached HEAD. */
      branch: string | null
      /** The upstream of the branch, for example `origin/main`. `null` when it has none. */
      upstream: string | null
      /** The remote that a push uses: the remote of the upstream, else `origin`, else the first. */
      remote: string | null
      /** The commits that are not pushed: not on the upstream, or on no remote at all. */
      ahead: number
    }

/** Why a push failed. `rejected`: the remote has commits that this repo has not (pull first). */
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

/** Reads the branch, the upstream and the commits that are not pushed. It runs no network call. */
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

  // With an upstream: the commits that it lacks. Without one: the commits on no remote branch. A
  // repo with no commit yet has no HEAD, so the count fails and reads as 0.
  const count = await gitOrNull(
    root,
    upstream
      ? ['rev-list', '--count', '@{u}..HEAD']
      : ['rev-list', '--count', 'HEAD', '--not', '--remotes']
  )
  const ahead = Math.max(0, Number.parseInt(count ?? '0', 10) || 0)

  return { repo: true, branch, upstream, remote, ahead }
}

/** Sorts the stderr text of a failed push into a reason. */
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

/**
 * Pushes the current branch. A branch with no upstream is pushed to the remote of the status and
 * gets it as its upstream. Git never asks for a password in the terminal (`GIT_TERMINAL_PROMPT=0`),
 * and the push stops after `timeout` ms. A credential helper of the system can still ask in a
 * window. Throws `LocalPushFailure`.
 */
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
