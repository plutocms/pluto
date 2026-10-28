import type { PlutoGithubFile, PlutoGithubStore } from './types'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { gitBlobSha, listingOid } from '../utils/blob-sha'
import { PlutoGithubConflictError, PlutoGithubStoreError } from './errors'
import { commitLocalFiles } from './local-git'

export interface FsStoreOptions {
  /** The absolute root dir. All paths are relative to it. */
  root: string
  /**
   * The dir, relative to `root`, whose files make the head id. Set it to the
   * content dir. Default: the whole root. Never leave the default when the
   * root is a project dir: the head would read every file, `node_modules`
   * too, on each request.
   */
  headDir?: string
  /**
   * Commit each write to the local Git repo of `root` (local Git publishing). The files are
   * written first, so a commit that fails (a hook, no Git author) never loses the save: a
   * warning says why. Default false.
   */
  gitCommit?: boolean
}

// A skip-deploy marker belongs to a push from the admin. A local commit reaches the remote
// later, with the author's own push, which must deploy.
const SKIP_MARKER = /\s*\[skip ci\]\s*$/

let warnedNoRepo = false

/** Dirs the head never reads: dependencies, build output and dot dirs. */
const SKIPPED_DIRS = new Set([
  'node_modules',
  '.nuxt',
  '.output',
  '.data',
  '.nitro',
  '.cache',
  'dist',
])

/**
 * A store over the local file system, for dev. The head id is a hash of the
 * file listing (path and blob id) under `headDir`, so it changes after a
 * write. A file change made by hand changes it too. With `gitCommit`, each
 * write is also a commit in the local Git repo.
 */
export function createFsStore(options: FsStoreOptions): PlutoGithubStore {
  const root = resolve(options.root)
  const headRoot = options.headDir ? resolve(root, options.headDir) : root

  function safePath(path: string): string {
    const full = resolve(root, path)
    const rel = relative(root, full)
    if (
      !path ||
      isAbsolute(path) ||
      rel === '' ||
      rel.startsWith('..') ||
      isAbsolute(rel)
    ) {
      throw new PlutoGithubStoreError(
        'forbidden',
        `The path "${path}" is outside the content root.`
      )
    }
    return full
  }

  async function walk(
    dir: string,
    out: {
      path: string
      oid: string
    }[]
  ): Promise<void> {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = resolve(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || SKIPPED_DIRS.has(entry.name)) {
          continue
        }
        await walk(full, out)
      } else if (entry.isFile()) {
        const text = await readFile(full, 'utf8')
        out.push({
          path: relative(root, full).split(sep).join('/'),
          oid: gitBlobSha(text),
        })
      }
    }
  }

  /** Collects the `.md` files under `dir`. It skips dot dirs, dot files and the skipped dirs. */
  async function walkMarkdown(dir: string, out: string[]): Promise<void> {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        continue
      }
      const full = resolve(dir, entry.name)
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name)) {
          await walkMarkdown(full, out)
        }
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        out.push(full)
      }
    }
  }

  async function currentHead(): Promise<string> {
    const entries: {
      path: string
      oid: string
    }[] = []
    await walk(headRoot, entries)
    return listingOid(entries)
  }

  async function read(path: string): Promise<PlutoGithubFile | null> {
    try {
      const text = await readFile(safePath(path), 'utf8')
      return {
        path,
        name: path.slice(path.lastIndexOf('/') + 1),
        oid: gitBlobSha(text),
        text,
      }
    } catch (error) {
      if (error instanceof PlutoGithubStoreError) {
        throw error
      }
      return null
    }
  }

  return {
    head: async () => currentHead(),
    listDir: async (dir) => {
      const base = dir.replace(/\/+$/, '')
      let names: string[]
      try {
        names = (
          await readdir(base === '' ? root : safePath(base), {
            withFileTypes: true,
          })
        )
          .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
          .map((entry) => entry.name)
      } catch (error) {
        if (error instanceof PlutoGithubStoreError) {
          throw error
        }
        return []
      }
      const files: PlutoGithubFile[] = []
      for (const name of names.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
        const file = await read(base === '' ? name : `${base}/${name}`)
        if (file) {
          files.push(file)
        }
      }
      return files
    },
    listTree: async (dir) => {
      const base = dir.replace(/\/+$/, '')
      const start = base === '' ? root : safePath(base)
      const found: string[] = []
      await walkMarkdown(start, found)
      const files: PlutoGithubFile[] = []
      for (const full of found.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
        const file = await read(relative(root, full).split(sep).join('/'))
        if (file) {
          files.push(file)
        }
      }
      return files
    },
    readFile: async (path) => read(path),
    commit: async (input) => {
      // Check every path first, so a bad path changes nothing.
      const additions = input.additions.map((item) => ({
        full: safePath(item.path),
        contents: item.contents,
      }))
      const deletions = input.deletions.map((item) => safePath(item.path))
      if (input.expectedHeadOid !== (await currentHead())) {
        throw new PlutoGithubConflictError()
      }
      for (const full of deletions) {
        await rm(full, { force: true })
      }
      for (const item of additions) {
        await mkdir(dirname(item.full), { recursive: true })
        await writeFile(item.full, item.contents, 'utf8')
      }
      if (options.gitCommit) {
        const paths = [...input.additions, ...input.deletions].map(
          (item) => item.path
        )
        try {
          const result = await commitLocalFiles(
            root,
            paths,
            input.message.replace(SKIP_MARKER, '')
          )
          if (
            !result.committed &&
            result.skipped !== 'no-changes' &&
            !warnedNoRepo
          ) {
            warnedNoRepo = true
            console.warn(
              result.skipped === 'no-git'
                ? '[pluto-github] Git is not installed. Pluto saves the files without a commit.'
                : '[pluto-github] The project is not a Git repo. Pluto saves the files without a commit. Run `git init` to commit each save.'
            )
          }
        } catch (error) {
          const detail =
            (error as { stderr?: string }).stderr?.trim() ||
            (error as Error).message
          console.warn(
            `[pluto-github] The save is on disk, but the local Git commit failed: ${detail}`
          )
        }
      }
      return { oid: await currentHead() }
    },
  }
}
