import type { PlutoGithubFile, PlutoGithubStore } from './types'
import { gitBlobSha, listingOid } from '../utils/blob-sha'
import { PlutoGithubConflictError } from './errors'

export interface MemoryStore extends PlutoGithubStore {
  /** Puts a file without a commit. For test setup. */
  seed: (path: string, text: string) => void
}

function byPath(a: PlutoGithubFile, b: PlutoGithubFile): number {
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0
}

function parentOf(path: string): string {
  const index = path.lastIndexOf('/')
  return index === -1 ? '' : path.slice(0, index)
}

/**
 * An in-memory store for tests. It keeps the current state only, so `listDir`
 * and `readFile` ignore the head id they get. The head id comes from the
 * content, so it changes after each change.
 */
export function createMemoryStore(
  initial: Record<string, string> = {}
): MemoryStore {
  const files = new Map<string, string>(Object.entries(initial))

  function currentHead(): string {
    return listingOid(
      [...files].map(([path, text]) => ({ path, oid: gitBlobSha(text) }))
    )
  }

  function toFile(path: string, text: string): PlutoGithubFile {
    return {
      path,
      name: path.slice(path.lastIndexOf('/') + 1),
      oid: gitBlobSha(text),
      text,
    }
  }

  return {
    seed: (path, text) => {
      files.set(path, text)
    },
    head: async () => currentHead(),
    listDir: async (dir) => {
      const base = dir.replace(/\/+$/, '')
      return [...files]
        .filter(([path]) => parentOf(path) === base && path.endsWith('.md'))
        .map(([path, text]) => toFile(path, text))
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    },
    listTree: async (dir) => {
      const base = dir.replace(/\/+$/, '')
      const prefix = base === '' ? '' : `${base}/`
      return [...files]
        .filter(
          ([path]) =>
            path.startsWith(prefix) &&
            path.endsWith('.md') &&
            !path
              .slice(prefix.length)
              .split('/')
              .some((part) => part.startsWith('.'))
        )
        .map(([path, text]) => toFile(path, text))
        .sort(byPath)
    },
    readFile: async (path) => {
      const text = files.get(path)
      return text === undefined ? null : toFile(path, text)
    },
    commit: async (input) => {
      if (input.expectedHeadOid !== currentHead()) {
        throw new PlutoGithubConflictError()
      }
      for (const deletion of input.deletions) {
        files.delete(deletion.path)
      }
      for (const addition of input.additions) {
        files.set(addition.path, addition.contents)
      }
      return { oid: currentHead() }
    },
  }
}
