export { isPlutoCmsConflictError, PlutoCmsConflictError, PlutoCmsStoreError } from './errors'
export type { PlutoCmsStoreErrorCode } from './errors'

export interface PlutoCmsFile {
  path: string
  name: string
  oid: string
  text: string
}

/** A GitHub token (user or server). The fs and memory stores ignore it. */
export interface PlutoCmsAuth {
  token: string
}

export interface PlutoCmsCommitInput {
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

export interface PlutoCmsStore {
  head: (opts?: {
 revalidate?: boolean
auth?: PlutoCmsAuth
}) => Promise<string>
  /** The `.md` files directly in `dir`, sorted by name. A missing dir gives `[]`. */
  listDir: (dir: string, headOid: string, auth?: PlutoCmsAuth) => Promise<PlutoCmsFile[]>
  /**
   * Every `.md` file under `dir`, at any depth (the adapter sets the depth limit), sorted by
   * path. A missing dir gives `[]`. Dot dirs and dot files are not listed.
   */
  listTree: (dir: string, headOid: string, auth?: PlutoCmsAuth) => Promise<PlutoCmsFile[]>
  readFile: (path: string, headOid: string, auth?: PlutoCmsAuth) => Promise<PlutoCmsFile | null>
  /** Throws a `PlutoCmsConflictError` when `expectedHeadOid` is stale. */
  commit: (input: PlutoCmsCommitInput, auth: PlutoCmsAuth) => Promise<{
 oid: string
}>
}
