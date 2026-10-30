import type { GithubFetch } from '../github/client'
import type { GithubCache } from '../utils/github-cache'
import type {
  PlutoGithubAuth,
  PlutoGithubFile,
  PlutoGithubStore,
} from './types'
import { Buffer } from 'node:buffer'
import { githubGraphql, githubRest } from '../github/client'
import { PlutoGithubStoreError } from './errors'

export interface GithubStoreOptions {
  /** `owner/name`. */
  repo: string
  branch: string
  apiUrl: string
  cache: GithubCache
  /**
   * A server token for public reads, when the caller sends no auth. It can
   * be a function, so the token can change over time (an installation token).
   */
  readToken?: string | (() => Promise<string | undefined>)
  /** A transport stub. Tests use it. */
  fetch?: GithubFetch
}

interface BlobNode {
  text?: string | null
  byteSize?: number
  isBinary?: boolean
  isTruncated?: boolean
  oid?: string
}

interface TreeQueryData {
  repository: {
    object: {
      entries?: {
        name: string
        type: string
        oid: string
        object?: BlobNode | null
      }[]
    } | null
  } | null
}

interface TreeNode {
  name: string
  type: string
  oid: string
  object?:
    | (BlobNode & {
        entries?: TreeNode[]
      })
    | null
}

interface NestedTreeQueryData {
  repository: {
    object: {
      entries?: TreeNode[]
    } | null
  } | null
}

interface BlobQueryData {
  repository: {
    object: BlobNode | null
  } | null
}

const TREE_QUERY = `query PlutoGithubTree($owner: String!, $name: String!, $expression: String!) {
  repository(owner: $owner, name: $name) {
    object(expression: $expression) {
      ... on Tree {
        entries {
          name
          type
          oid
          object {
            ... on Blob { text byteSize isBinary isTruncated }
          }
        }
      }
    }
  }
}`

/** The deepest folder level that the nested tree query reads. It matches the 6 segments of a nested id. */
const TREE_DEPTH = 6

/** One GraphQL query for the whole tree: a nested `... on Tree { entries }`, `TREE_DEPTH` levels deep. */
function buildNestedTreeQuery(depth: number): string {
  let level = ''
  for (let index = 0; index < depth; index++) {
    const inner = level === '' ? '' : ` ... on Tree { ${level} }`
    level = `entries { name type oid object { ... on Blob { text byteSize isBinary isTruncated }${inner} } }`
  }
  return `query PlutoGithubNestedTree($owner: String!, $name: String!, $expression: String!) {
  repository(owner: $owner, name: $name) {
    object(expression: $expression) {
      ... on Tree { ${level} }
    }
  }
}`
}

const NESTED_TREE_QUERY = buildNestedTreeQuery(TREE_DEPTH)

const BLOB_QUERY = `query PlutoGithubBlob($owner: String!, $name: String!, $expression: String!) {
  repository(owner: $owner, name: $name) {
    object(expression: $expression) {
      ... on Blob { oid text byteSize isBinary isTruncated }
    }
  }
}`

const COMMIT_MUTATION = `mutation PlutoGithubCommit($input: CreateCommitOnBranchInput!) {
  createCommitOnBranch(input: $input) {
    commit { oid }
  }
}`

function nameOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

function dirOf(path: string): string {
  const index = path.lastIndexOf('/')
  return index === -1 ? '' : path.slice(0, index)
}

/** Reads and writes a GitHub repo through the REST and GraphQL APIs. */
export function createGithubStore(
  options: GithubStoreOptions
): PlutoGithubStore {
  const [owner = '', name = ''] = options.repo.split('/')
  const { cache } = options

  async function tokenOf(auth?: PlutoGithubAuth): Promise<string | undefined> {
    if (auth?.token) {
      return auth.token
    }
    const { readToken } = options
    return (
      (typeof readToken === 'function' ? await readToken() : readToken) ||
      undefined
    )
  }

  function usable(
    blob: BlobNode | null | undefined,
    path: string
  ): blob is BlobNode & {
    text: string
  } {
    if (!blob) {
      return false
    }
    if (blob.isBinary || blob.isTruncated) {
      console.warn(
        `[pluto-github] Skipped "${path}": the file is binary or too large.`
      )
      return false
    }
    return typeof blob.text === 'string'
  }

  async function fetchHead(auth?: PlutoGithubAuth): Promise<string> {
    const cached = await cache.getHead()
    const result = await githubRest<string>(
      `/repos/${options.repo}/commits/${encodeURIComponent(options.branch)}`,
      {
        token: await tokenOf(auth),
        apiUrl: options.apiUrl,
        fetch: options.fetch,
        accept: 'application/vnd.github.sha',
        etag: cached?.etag,
      }
    )
    if (result.status === 304 && cached) {
      await cache.setHead(cached.oid, cached.etag)
      return cached.oid
    }
    const oid = String(result.data).trim()
    await cache.setHead(oid, result.etag)
    return oid
  }

  return {
    async head(opts = {}) {
      const cached = await cache.getHead()
      if (cached && !opts.revalidate && cache.isHeadFresh(cached)) {
        return cached.oid
      }
      return cache.singleFlight('head', () => fetchHead(opts.auth))
    },

    async listDir(dir, headOid, auth) {
      const base = dir.replace(/\/+$/, '')
      const cached = await cache.getIndex<PlutoGithubFile[]>(base, headOid)
      if (cached) {
        return cached
      }
      return cache.singleFlight(`index:${base}@${headOid}`, async () => {
        const data = await githubGraphql<TreeQueryData>(
          TREE_QUERY,
          { owner, name, expression: `${headOid}:${base}` },
          {
            token: await tokenOf(auth),
            apiUrl: options.apiUrl,
            fetch: options.fetch,
          }
        )
        const entries = data.repository?.object?.entries ?? []
        const files: PlutoGithubFile[] = []
        for (const entry of entries) {
          if (entry.type !== 'blob' || !entry.name.endsWith('.md')) {
            continue
          }
          const path = base === '' ? entry.name : `${base}/${entry.name}`
          if (usable(entry.object, path)) {
            files.push({
              path,
              name: entry.name,
              oid: entry.oid,
              text: entry.object.text,
            })
          }
        }
        files.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        await cache.setIndex(base, headOid, files)
        return files
      })
    },

    async listTree(dir, headOid, auth) {
      const base = dir.replace(/\/+$/, '')
      const cacheDir = `tree:${base}`
      const cached = await cache.getIndex<PlutoGithubFile[]>(cacheDir, headOid)
      if (cached) {
        return cached
      }
      return cache.singleFlight(`${cacheDir}@${headOid}`, async () => {
        const data = await githubGraphql<NestedTreeQueryData>(
          NESTED_TREE_QUERY,
          { owner, name, expression: `${headOid}:${base}` },
          {
            token: await tokenOf(auth),
            apiUrl: options.apiUrl,
            fetch: options.fetch,
          }
        )
        const files: PlutoGithubFile[] = []
        const visit = (entries: TreeNode[] | undefined, parent: string) => {
          for (const entry of entries ?? []) {
            const path = parent === '' ? entry.name : `${parent}/${entry.name}`
            if (entry.name.startsWith('.')) {
              continue
            }
            if (entry.type === 'tree') {
              visit(entry.object?.entries, path)
            } else if (
              entry.type === 'blob' &&
              entry.name.endsWith('.md') &&
              usable(entry.object, path)
            ) {
              files.push({
                path,
                name: entry.name,
                oid: entry.oid,
                text: entry.object.text,
              })
            }
          }
        }
        visit(data.repository?.object?.entries, base)
        files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
        await cache.setIndex(cacheDir, headOid, files)
        return files
      })
    },

    async readFile(path, headOid, auth) {
      const index = await cache.getIndex<PlutoGithubFile[]>(
        dirOf(path),
        headOid
      )
      if (index) {
        return index.find((file) => file.path === path) ?? null
      }
      return cache.singleFlight(`file:${path}@${headOid}`, async () => {
        const data = await githubGraphql<BlobQueryData>(
          BLOB_QUERY,
          { owner, name, expression: `${headOid}:${path}` },
          {
            token: await tokenOf(auth),
            apiUrl: options.apiUrl,
            fetch: options.fetch,
          }
        )
        const blob = data.repository?.object
        if (!usable(blob, path) || !blob.oid) {
          return null
        }
        return { path, name: nameOf(path), oid: blob.oid, text: blob.text }
      })
    },

    async readRaw(path, auth) {
      const token = await tokenOf(auth)
      const encoded = path.split('/').map(encodeURIComponent).join('/')
      try {
        const result = await githubRest<ArrayBuffer>(
          `/repos/${options.repo}/contents/${encoded}?ref=${encodeURIComponent(options.branch)}`,
          {
            token,
            apiUrl: options.apiUrl,
            fetch: options.fetch,
            accept: 'application/vnd.github.raw',
          }
        )
        return new Uint8Array(result.data)
      } catch (error) {
        if (error instanceof PlutoGithubStoreError && error.code === 'not-found') {
          return null
        }
        throw error
      }
    },
    async commit(input, auth) {
      if (!auth?.token) {
        throw new PlutoGithubStoreError(
          'auth',
          'A commit needs a GitHub token.',
          { status: 401 }
        )
      }
      const [headline = '', ...rest] = input.message.split('\n')
      const body = rest.join('\n').trim()
      const data = await githubGraphql<{
        createCommitOnBranch: {
          commit: {
            oid: string
          }
        }
      }>(
        COMMIT_MUTATION,
        {
          input: {
            branch: {
              repositoryNameWithOwner: options.repo,
              branchName: options.branch,
            },
            message: body ? { headline, body } : { headline },
            expectedHeadOid: input.expectedHeadOid,
            fileChanges: {
              additions: input.additions.map((item) => ({
                path: item.path,
                contents:
                  item.encoding === 'base64'
                    ? item.contents
                    : Buffer.from(item.contents, 'utf8').toString('base64'),
              })),
              deletions: input.deletions.map((item) => ({ path: item.path })),
            },
          },
        },
        { token: auth.token, apiUrl: options.apiUrl, fetch: options.fetch }
      )
      const oid = data.createCommitOnBranch.commit.oid
      await cache.setHead(oid)
      return { oid }
    },
  }
}
