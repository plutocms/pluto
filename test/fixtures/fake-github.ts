import type { GithubFetch, GithubFetchResponse } from '../../modules/pluto-cms/runtime/server/github/client'
import { Buffer } from 'node:buffer'
import { gitBlobSha, listingOid } from '../../modules/pluto-cms/runtime/server/utils/blob-sha'

export interface FakeGithubCalls {
  /** REST head calls that answered 200. */
  head: number
  /** REST head calls that answered 304. */
  headNotModified: number
  /** Every GraphQL call. */
  graphql: number
  tree: number
  blob: number
  commit: number
}

export interface FakeGithubOptions {
  repo?: string
  branch?: string
  files?: Record<string, string>
  /** Paths that the fake reports as binary files. */
  binary?: string[]
  /** Paths that the fake reports as truncated files. */
  truncated?: string[]
}

interface FailureStub {
  status: number
  headers?: Record<string, string>
  body?: unknown
}

/**
 * An in-memory GitHub with one repo and one branch. `fetch` has the shape of
 * the `GithubFetch` transport. It supports the head REST call, the tree and
 * blob GraphQL queries, and `createCommitOnBranch`.
 */
export function createFakeGithub(options: FakeGithubOptions = {}) {
  const repo = options.repo ?? 'acme/site'
  const branch = options.branch ?? 'main'
  const binary = new Set(options.binary ?? [])
  const truncated = new Set(options.truncated ?? [])
  const snapshots = new Map<string, Map<string, string>>()
  let files = new Map<string, string>(Object.entries(options.files ?? {}))
  let headOid = snapshot()
  let failure: FailureStub | undefined
  let delayMs = 0

  const calls: FakeGithubCalls = { head: 0, headNotModified: 0, graphql: 0, tree: 0, blob: 0, commit: 0 }

  function snapshot(): string {
    const oid = listingOid([...files].map(([path, text]) => ({ path, oid: gitBlobSha(text) })))
    snapshots.set(oid, new Map(files))
    return oid
  }

  function respond(status: number, data: unknown, headers: Record<string, string> = {}): GithubFetchResponse {
    const lower = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]))
    return { status, headers: { get: (name) => lower[name.toLowerCase()] ?? null }, data }
  }

  function header(init: {
 headers: Record<string, string>
}, name: string): string | undefined {
    const key = Object.keys(init.headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase())
    return key === undefined ? undefined : init.headers[key]
  }

  function blobNode(path: string, text: string) {
    return {
      oid: gitBlobSha(text),
      text: binary.has(path) ? null : text,
      byteSize: Buffer.byteLength(text),
      isBinary: binary.has(path),
      isTruncated: truncated.has(path),
    }
  }

  function resolveObject(expression: string) {
    const separator = expression.indexOf(':')
    const oid = expression.slice(0, separator)
    const path = expression.slice(separator + 1).replace(/\/+$/, '')
    const snap = snapshots.get(oid)
    if (!snap) {
      return null
    }
    if (snap.has(path)) {
      return { kind: 'blob' as const, path, text: snap.get(path)! }
    }
    const prefix = path === '' ? '' : `${path}/`
    const entries: {
 name: string
type: 'blob' | 'tree'
oid: string
object: unknown
}[] = []
    const seen = new Set<string>()
    for (const [filePath, text] of snap) {
      if (!filePath.startsWith(prefix)) {
        continue
      }
      const rest = filePath.slice(prefix.length)
      const slash = rest.indexOf('/')
      if (slash === -1) {
        entries.push({ name: rest, type: 'blob', oid: gitBlobSha(text), object: blobNode(filePath, text) })
      } else if (!seen.has(rest.slice(0, slash))) {
        seen.add(rest.slice(0, slash))
        entries.push({ name: rest.slice(0, slash), type: 'tree', oid: 'tree', object: {} })
      }
    }
    return entries.length > 0 ? { kind: 'tree' as const, entries } : null
  }

  function graphqlError(type: string, message: string): GithubFetchResponse {
    return respond(200, { data: null, errors: [{ type, message }] })
  }

  const fetch: GithubFetch = async (url, init) => {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
    if (failure) {
      const stub = failure
      failure = undefined
      return respond(stub.status, stub.body ?? { message: 'Failure' }, stub.headers)
    }
    const { pathname } = new URL(url)

    if (init.method === 'GET' && pathname === `/repos/${repo}/commits/${branch}`) {
      const etag = `"${headOid}"`
      if (header(init, 'If-None-Match') === etag) {
        calls.headNotModified++
        return respond(304, undefined, { ETag: etag })
      }
      calls.head++
      return respond(200, headOid, { ETag: etag })
    }

    if (init.method === 'POST' && pathname.endsWith('/graphql')) {
      calls.graphql++
      const { query, variables } = JSON.parse(init.body ?? '{}') as {
 query: string
variables: Record<string, any>
}

      if (query.includes('createCommitOnBranch')) {
        calls.commit++
        const input = variables.input
        if (input.branch.repositoryNameWithOwner !== repo || input.branch.branchName !== branch) {
          return graphqlError('NOT_FOUND', 'Could not resolve to a Ref.')
        }
        if (input.expectedHeadOid !== headOid) {
          return graphqlError('STALE_DATA', `Expected branch to point to "${input.expectedHeadOid}" but it did not. Pull and try again.`)
        }
        for (const deletion of input.fileChanges.deletions ?? []) {
          files.delete(deletion.path)
        }
        for (const addition of input.fileChanges.additions ?? []) {
          files.set(addition.path, Buffer.from(addition.contents, 'base64').toString('utf8'))
        }
        headOid = snapshot()
        return respond(200, { data: { createCommitOnBranch: { commit: { oid: headOid } } } })
      }

      const object = resolveObject(variables.expression)
      if (query.includes('entries')) {
        calls.tree++
        const entries = object?.kind === 'tree' ? object.entries : undefined
        return respond(200, { data: { repository: { object: entries ? { entries } : null } } })
      }
      calls.blob++
      const node = object?.kind === 'blob' ? blobNode(object.path, object.text) : null
      return respond(200, { data: { repository: { object: node } } })
    }

    return respond(404, { message: 'Not Found' })
  }

  return {
    fetch,
    calls,
    repo,
    branch,
    get head() {
      return headOid
    },
    /** Changes a file as if another user pushed. Returns the new head. */
    push(path: string, text: string | null): string {
      files = new Map(files)
      if (text === null) {
        files.delete(path)
      } else {
        files.set(path, text)
      }
      headOid = snapshot()
      return headOid
    },
    read: (path: string) => files.get(path),
    /** Makes the next request answer with this failure. */
    failNext(stub: FailureStub) {
      failure = stub
    },
    setDelay(ms: number) {
      delayMs = ms
    },
  }
}
