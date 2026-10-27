export { isPlutoGithubConflictError, PlutoGithubConflictError, PlutoGithubStoreError } from './errors'
export type { PlutoGithubStoreErrorCode } from './errors'

export interface PlutoGithubFile {
  path: string
  name: string
  oid: string
  text: string
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
contents: string
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
  listDir: (dir: string, headOid: string, auth?: PlutoGithubAuth) => Promise<PlutoGithubFile[]>
  /**
   * Every `.md` file under `dir`, at any depth (the adapter sets the depth limit), sorted by
   * path. A missing dir gives `[]`. Dot dirs and dot files are not listed.
   */
  listTree: (dir: string, headOid: string, auth?: PlutoGithubAuth) => Promise<PlutoGithubFile[]>
  readFile: (path: string, headOid: string, auth?: PlutoGithubAuth) => Promise<PlutoGithubFile | null>
  /** Throws a `PlutoGithubConflictError` when `expectedHeadOid` is stale. */
  commit: (input: PlutoGithubCommitInput, auth: PlutoGithubAuth) => Promise<{
 oid: string
}>
}
