import type { PlutoGithubAuth, PlutoGithubStore } from './types'
import { PlutoGithubStoreError } from './errors'
import { createMemoryStore } from './memory'

/**
 * Loads the Markdown files of the content dir, as the build saw them: `{ <repo path>: text }`.
 * The module bundles them as Nitro server assets (`pluto-content`). An empty object means no
 * snapshot.
 */
export type SnapshotLoader = () => Promise<Record<string, string>>

/**
 * A read-only store over the snapshot of the build. A commit throws `forbidden`: the snapshot is
 * only for public reads when GitHub cannot answer (no credentials yet, or a GitHub failure).
 */
export function createSnapshotStore(load: SnapshotLoader): PlutoGithubStore & {
  /** Whether the build bundled any file. */
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

/** The `history` and `readAt` of a store, when it has them. */
function historyOf(
  store: PlutoGithubStore
): Pick<PlutoGithubStore, 'history' | 'readAt'> {
  return {
    ...(store.history && { history: store.history }),
    ...(store.readAt && { readAt: store.readAt }),
  }
}

/**
 * The store of a deployed site that has no GitHub credentials yet (no read token, no App): a
 * call with the token of a signed-in user goes to GitHub, and an anonymous read goes to the
 * snapshot of the build, so the public site shows its content before the GitHub App is set up.
 * With no snapshot, every call goes to GitHub, as before.
 */
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
    // The history is for editors: GitHub only. The snapshot has none.
    ...historyOf(github),
  }
}

/**
 * The store of a deployed site that reads GitHub (hybrid): an anonymous read goes to GitHub, and
 * when GitHub fails (an outage, a rate limit, a bad App key), the same read goes to the snapshot
 * of the build. So the public pages stay up. The snapshot ignores the head id, so a GitHub head
 * can come before a snapshot read. A call with the token of a signed-in user never falls back:
 * the admin must not edit old content. A conflict is not a failure. With no snapshot, the error
 * stays. `onFallback` gets the GitHub error.
 */
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
    // The history is for editors: GitHub only. The snapshot has none.
    ...historyOf(github),
  }
}
