import type { PlutoGithubAuth, PlutoGithubStore } from './types'
import { PlutoGithubStoreError } from './errors'
import { createMemoryStore } from './memory'

export type SnapshotLoader = () => Promise<Record<string, string>>

export function createSnapshotStore(load: SnapshotLoader): PlutoGithubStore & {
  hasFiles: () => Promise<boolean>
} {
  let ready: Promise<ReturnType<typeof createMemoryStore>> | undefined
  const store = () => {
    ready ??= load().then((files) => createMemoryStore(files))
    return ready
  }
  let count: Promise<number> | undefined
  return {
    hasFiles: async () => {
      count ??= load().then((files) => Object.keys(files).length)
      return (await count) > 0
    },
    head: async () => (await store()).head(),
    listDir: async (dir, head) => (await store()).listDir(dir, head),
    listTree: async (dir, head) => (await store()).listTree(dir, head),
    readFile: async (path, head) => (await store()).readFile(path, head),
    readRaw: async (path) => (await store()).readRaw(path),
    commit: async () => {
      throw new PlutoGithubStoreError(
        'forbidden',
        'The content of the build is read only.'
      )
    },
  }
}

function historyOf(
  store: PlutoGithubStore
): Pick<PlutoGithubStore, 'history' | 'readAt'> {
  return {
    ...(store.history && { history: store.history }),
    ...(store.readAt && { readAt: store.readAt }),
  }
}

export function withBuildSnapshot(
  github: PlutoGithubStore,
  snapshot: ReturnType<typeof createSnapshotStore>,
  onFallback: () => void = () => {}
): PlutoGithubStore {
  async function pick(auth?: PlutoGithubAuth): Promise<PlutoGithubStore> {
    if (auth?.token || !(await snapshot.hasFiles())) {
      return github
    }
    onFallback()
    return snapshot
  }
  return {
    head: async (opts) => (await pick(opts?.auth)).head(opts),
    listDir: async (dir, head, auth) =>
      (await pick(auth)).listDir(dir, head, auth),
    listTree: async (dir, head, auth) =>
      (await pick(auth)).listTree(dir, head, auth),
    readFile: async (path, head, auth) =>
      (await pick(auth)).readFile(path, head, auth),
    readRaw: async (path, auth) => (await pick(auth)).readRaw(path, auth),
    commit: (input, auth) => github.commit(input, auth),
    ...historyOf(github),
  }
}

export function withSnapshotFallback(
  github: PlutoGithubStore,
  snapshot: ReturnType<typeof createSnapshotStore>,
  onFallback: (error: unknown) => void = () => {}
): PlutoGithubStore {
  async function read<T>(
    auth: PlutoGithubAuth | undefined,
    fromGithub: () => Promise<T>,
    fromSnapshot: () => Promise<T>
  ): Promise<T> {
    if (auth?.token) {
      return fromGithub()
    }
    try {
      return await fromGithub()
    } catch (error) {
      if (
        (error instanceof PlutoGithubStoreError && error.code === 'conflict') ||
        !(await snapshot.hasFiles())
      ) {
        throw error
      }
      onFallback(error)
      return fromSnapshot()
    }
  }
  return {
    head: (opts) =>
      read(
        opts?.auth,
        () => github.head(opts),
        () => snapshot.head()
      ),
    listDir: (dir, head, auth) =>
      read(
        auth,
        () => github.listDir(dir, head, auth),
        () => snapshot.listDir(dir, head)
      ),
    listTree: (dir, head, auth) =>
      read(
        auth,
        () => github.listTree(dir, head, auth),
        () => snapshot.listTree(dir, head)
      ),
    readFile: (path, head, auth) =>
      read(
        auth,
        () => github.readFile(path, head, auth),
        () => snapshot.readFile(path, head)
      ),
    readRaw: (path, auth) =>
      read(
        auth,
        () => github.readRaw(path, auth),
        () => snapshot.readRaw(path)
      ),
    commit: (input, auth) => github.commit(input, auth),
    ...historyOf(github),
  }
}
