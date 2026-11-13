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

export interface PlutoGithubCommitInfo {
  oid: string
  message: string
  committedAt: string
  author: {
    name: string
    login?: string
    avatarUrl?: string
  }
}

export interface PlutoGithubAuth {
  token: string
}

export interface PlutoGithubCommitInput {
  expectedHeadOid: string
  message: string
  additions: {
    path: string
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
  listDir: (
    dir: string,
    headOid: string,
    auth?: PlutoGithubAuth
  ) => Promise<PlutoGithubFile[]>
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
  readRaw: (path: string, auth?: PlutoGithubAuth) => Promise<Uint8Array | null>
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
  readAt?: (
    path: string,
    commitOid: string,
    auth?: PlutoGithubAuth
  ) => Promise<PlutoGithubFile | null>
  commit: (
    input: PlutoGithubCommitInput,
    auth: PlutoGithubAuth
  ) => Promise<{
    oid: string
  }>
}
