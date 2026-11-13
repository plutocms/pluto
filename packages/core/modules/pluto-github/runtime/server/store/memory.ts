import type { PlutoGithubFile, PlutoGithubStore } from './types'
import { Buffer } from 'node:buffer'
import { gitBlobSha, listingOid } from '../utils/blob-sha'
import { PlutoGithubConflictError } from './errors'

export interface MemoryStore extends PlutoGithubStore {
  seed: (path: string, text: string) => void
}

function byPath(a: PlutoGithubFile, b: PlutoGithubFile): number {
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0
}

function parentOf(path: string): string {
  const index = path.lastIndexOf('/')
  return index === -1 ? '' : path.slice(0, index)
}

export function createMemoryStore(
  initial: Record<string, string> = {}
): MemoryStore {
  const files = new Map<string, string>(Object.entries(initial))
  const raw = new Map<string, string>()
  const log: {
    oid: string
    message: string
    committedAt: string
    files: Map<string, string>
  }[] = []

  function currentHead(): string {
    return listingOid(
      [...files, ...raw].map(([path, text]) => ({
        path,
        oid: gitBlobSha(text),
      }))
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
    history: async (path, query) => {
      const newest = log
        .filter((entry, index) => {
          const before =
            index === 0 ? initial[path] : log[index - 1]!.files.get(path)
          return entry.files.get(path) !== before
        })
        .reverse()
      const skip = Number.parseInt(query.cursor ?? '0', 10) || 0
      return {
        commits: newest.slice(skip, skip + query.limit).map((entry) => ({
          oid: entry.oid,
          message: entry.message,
          committedAt: entry.committedAt,
          author: { name: 'Memory' },
        })),
        ...(newest.length > skip + query.limit && {
          nextCursor: String(skip + query.limit),
        }),
      }
    },
    readAt: async (path, commitOid) => {
      const text = log.find((entry) => entry.oid === commitOid)?.files.get(path)
      return text === undefined ? null : toFile(path, text)
    },
    readRaw: async (path) => {
      const base64 = raw.get(path)
      if (base64 !== undefined) {
        return new Uint8Array(Buffer.from(base64, 'base64'))
      }
      const text = files.get(path)
      return text === undefined ? null : new TextEncoder().encode(text)
    },
    commit: async (input) => {
      if (input.expectedHeadOid !== currentHead()) {
        throw new PlutoGithubConflictError()
      }
      for (const deletion of input.deletions) {
        files.delete(deletion.path)
        raw.delete(deletion.path)
      }
      for (const addition of input.additions) {
        if (addition.encoding === 'base64') {
          raw.set(addition.path, addition.contents)
        } else {
          files.set(addition.path, addition.contents)
        }
      }
      log.push({
        oid: `c${log.length + 1}`,
        message: input.message.split('\n')[0] ?? '',
        committedAt: new Date(
          Date.UTC(2026, 0, 1, 0, log.length)
        ).toISOString(),
        files: new Map(files),
      })
      return { oid: currentHead() }
    },
  }
}
