import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'

/**
 * Turns a GitHub remote URL into `owner/name`. It reads the https, ssh and
 * `git@` forms of github.com. It returns `undefined` for any other host.
 */
export function parseGithubRepoUrl(url: string): string | undefined {
  const value = url.trim()
  const match
    = /^(?:https?|git|ssh):\/\/(?:[^@/]+@)?github\.com(?::\d+)?\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i.exec(value)
      ?? /^(?:[^@/\s]+@)?github\.com:([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i.exec(value)
  return match ? `${match[1]}/${match[2]}` : undefined
}

/** Reads the `url` of the `origin` remote from the text of a git config file. */
export function parseGitConfigOrigin(text: string): string | undefined {
  let inOrigin = false
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line.startsWith('[')) {
      inOrigin = /^\[remote\s+"origin"\]$/.test(line)
    } else if (inOrigin) {
      const match = /^url\s*=\s*(\S.*)$/.exec(line)
      if (match) {
        return match[1]!.trim()
      }
    }
  }
  return undefined
}

/** Finds the git config file of the repo that holds `rootDir`. No shell call. */
function findGitConfig(rootDir: string): string | undefined {
  let dir = resolve(rootDir)
  for (;;) {
    const dotGit = join(dir, '.git')
    if (existsSync(dotGit)) {
      if (statSync(dotGit).isDirectory()) {
        return join(dotGit, 'config')
      }
      // A worktree or a submodule: `.git` is a file with `gitdir: <path>`.
      const pointer = /^gitdir: ?(\S.*)$/m.exec(readFileSync(dotGit, 'utf8'))
      if (pointer) {
        const gitDir = isAbsolute(pointer[1]!.trim()) ? pointer[1]!.trim() : resolve(dir, pointer[1]!.trim())
        const commonFile = join(gitDir, 'commondir')
        const commonDir = existsSync(commonFile) ? resolve(gitDir, readFileSync(commonFile, 'utf8').trim()) : gitDir
        return join(commonDir, 'config')
      }
      return undefined
    }
    const parent = dirname(dir)
    if (parent === dir) {
      return undefined
    }
    dir = parent
  }
}

/** The `origin` remote URL of the git repo that holds `rootDir`, or `undefined`. */
export function readGitOrigin(rootDir: string): string | undefined {
  try {
    const file = findGitConfig(rootDir)
    return file && existsSync(file) ? parseGitConfigOrigin(readFileSync(file, 'utf8')) : undefined
  } catch {
    return undefined
  }
}
