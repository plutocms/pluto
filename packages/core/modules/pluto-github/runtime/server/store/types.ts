export {
  isPlutoGithubConflictError,
  PlutoGithubConflictError,
  PlutoGithubStoreError,
} from './errors'
export type { PlutoGithubStoreErrorCode } from './errors'

export interface PlutoGithubFile {
  path: string
  name: string
  oid: string
  text: string
}

/** One commit of a file history. */
export interface PlutoGithubCommitInfo {
  oid: string
  /** The first line of the message. */
  message: string
  /** An ISO timestamp. */
  committedAt: string
  author: {
    name: string
    login?: string
    avatarUrl?: string
  }
}

/** A GitHub token (user or server). The fs and memory stores ignore it. */
export interface PlutoGithubAuth {
  token: string
}

export interface PlutoGithubCommitInput {
  expectedHeadOid: string
  message: string
  additions: {
    path: string
    /** UTF-8 text, or base64 for a binary file (`encoding: 'base64'`). */
    contents: string
    encoding?: 'utf8' | 'base64'
  }[]
  deletions: {
    path: string
  }[]
}

export interface PlutoGithubStore {
  head: (opts?: {
    revalidate?: boolean
    auth?: PlutoGithubAuth
  }) => Promise<string>
  /** The `.md` files directly in `dir`, sorted by name. A missing dir gives `[]`. */
  listDir: (
    dir: string,
    headOid: string,
    auth?: PlutoGithubAuth
  ) => Promise<PlutoGithubFile[]>
  /**
   * Every `.md` file under `dir`, at any depth (the adapter sets the depth limit), sorted by
   * path. A missing dir gives `[]`. Dot dirs and dot files are not listed.
   */
  listTree: (
    dir: string,
    headOid: string,
    auth?: PlutoGithubAuth
  ) => Promise<PlutoGithubFile[]>
  readFile: (
    path: string,
    headOid: string,
    auth?: PlutoGithubAuth
  ) => Promise<PlutoGithubFile | null>
  /** The bytes of any file (a media file), at the branch head. `null` when it does not exist. */
  readRaw: (path: string, auth?: PlutoGithubAuth) => Promise<Uint8Array | null>
  /**
   * The commits that changed one file, newest first. Optional: a store without it has no history
   * (the build snapshot). `cursor` is the `nextCursor` of the page before. Renames are not followed.
   */
  history?: (
    path: string,
    query: {
      limit: number
      cursor?: string
    },
    auth?: PlutoGithubAuth
  ) => Promise<{
    commits: PlutoGithubCommitInfo[]
    nextCursor?: string
  }>
  /** One file as it was at a commit. `null` when the file was not there. Optional, with `history`. */
  readAt?: (
    path: string,
    commitOid: string,
    auth?: PlutoGithubAuth
  ) => Promise<PlutoGithubFile | null>
  /** Throws a `PlutoGithubConflictError` when `expectedHeadOid` is stale. */
  commit: (
    input: PlutoGithubCommitInput,
    auth: PlutoGithubAuth
  ) => Promise<{
    oid: string
  }>
}
