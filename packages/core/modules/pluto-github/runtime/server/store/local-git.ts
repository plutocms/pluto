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
