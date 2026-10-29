import type {
  GithubFetch,
  GithubFetchResponse,
} from '../../modules/pluto-github/runtime/server/github/client'
import { Buffer } from 'node:buffer'
import { createVerify, randomBytes } from 'node:crypto'
import {
  gitBlobSha,
  listingOid,
} from '../../modules/pluto-github/runtime/server/utils/blob-sha'

export interface FakeGithubCalls {
  /** REST head calls that answered 200. */
  head: number
  /** REST head calls that answered 304. */
  headNotModified: number
  /** Every GraphQL call. */
  graphql: number
  /** The bearer token of each GraphQL call, in order. An empty string means no token. */
  graphqlTokens: string[]
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
  /** Whether the repo is private. Default true. */
  private?: boolean
  /** The GitHub users by login. `permission` is the role on the repo. `installed: false` hides the repo from the App (a 404). */
  users?: Record<string, FakeGithubUser>
  /** The GitHub App. With a `publicKey`, the fake checks the JWT signature. */
  app?: {
    id: string
    installationId?: number
    publicKey?: string
  }
  /** The clock for the expiry of installation tokens. Default `Date.now`. */
  clock?: () => number
  /** Seconds an installation token lives. Default 3600. */
  appTokenTtl?: number
}

export interface FakeGithubUser {
  id?: number
  name?: string | null
  permission: 'admin' | 'maintain' | 'push' | 'triage' | 'read' | 'none'
  installed?: boolean
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
  // The bytes of each committed file, as base64, for the raw contents API.
  const raw = new Map<string, string>()
  let headOid = snapshot()
  let failure: FailureStub | undefined
  let delayMs = 0

  const calls: FakeGithubCalls = {
    head: 0,
    headNotModified: 0,
    graphql: 0,
    graphqlTokens: [],
    tree: 0,
    blob: 0,
    commit: 0,
  }

  function snapshot(): string {
    const oid = listingOid(
      [...files].map(([path, text]) => ({ path, oid: gitBlobSha(text) }))
    )
    snapshots.set(oid, new Map(files))
    return oid
  }

  function respond(
    status: number,
    data: unknown,
    headers: Record<string, string> = {}
  ): GithubFetchResponse {
    const lower = Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
    )
    return {
      status,
      headers: { get: (name) => lower[name.toLowerCase()] ?? null },
      data,
    }
  }

  function header(
    init: {
      headers: Record<string, string>
    },
    name: string
  ): string | undefined {
    const key = Object.keys(init.headers).find(
      (candidate) => candidate.toLowerCase() === name.toLowerCase()
    )
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

  type Resolved =
    | {
        kind: 'blob'
        path: string
        text: string
      }
    | {
        kind: 'tree'
        entries: {
          name: string
          type: 'blob' | 'tree'
          oid: string
          object: unknown
        }[]
      }
    | null

  function resolveObject(expression: string): Resolved {
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
        entries.push({
          name: rest,
          type: 'blob',
          oid: gitBlobSha(text),
          object: blobNode(filePath, text),
        })
      } else if (!seen.has(rest.slice(0, slash))) {
        seen.add(rest.slice(0, slash))
        // A nested query (`... on Tree { entries }`) reads the folder too, so every tree entry
        // carries its own entries. The flat query does not ask for them.
        const child = resolveObject(`${oid}:${prefix}${rest.slice(0, slash)}`)
        entries.push({
          name: rest.slice(0, slash),
          type: 'tree',
          oid: 'tree',
          object: child?.kind === 'tree' ? { entries: child.entries } : {},
        })
      }
    }
    return entries.length > 0 ? { kind: 'tree' as const, entries } : null
  }

  function graphqlError(type: string, message: string): GithubFetchResponse {
    return respond(200, { data: null, errors: [{ type, message }] })
  }

  // --- Users, OAuth and the App ---------------------------------------------

  const isPrivate = options.private ?? true
  const users: Record<string, FakeGithubUser> = { ...options.users }
  const clock = options.clock ?? Date.now
  const appTokenTtl = options.appTokenTtl ?? 3600
  const userTokens = new Map<string, string>()
  const refreshTokens = new Map<string, string>()
  const codes = new Map<string, string>()
  const installTokens = new Set<string>()
  const oauth = {
    clientId: 'client-id',
    clientSecret: 'client-secret',
    /** Seconds a new user token lives. */
    expiresIn: 28_800,
    /** Every body that the token endpoint received. */
    exchanges: [] as Record<string, string>[],
    issueCode(login: string): string {
      const code = `code_${randomBytes(6).toString('hex')}`
      codes.set(code, login)
      return code
    },
    /** Makes a user token invalid, like a revoked token. */
    revokeToken(token: string) {
      userTokens.delete(token)
    },
    revokeRefreshToken(token: string) {
      refreshTokens.delete(token)
    },
    /** The last token pair the endpoint issued. */
    last: { accessToken: '', refreshToken: '' },
  }
  const appCalls = {
    lookups: 0,
    tokenRequests: [] as Record<string, unknown>[],
    jwts: [] as Record<string, unknown>[],
  }

  function issueTokens(login: string): GithubFetchResponse {
    const accessToken = `ghu_${randomBytes(8).toString('hex')}`
    const refreshToken = `ghr_${randomBytes(8).toString('hex')}`
    userTokens.set(accessToken, login)
    refreshTokens.set(refreshToken, login)
    oauth.last = { accessToken, refreshToken }
    return respond(200, {
      access_token: accessToken,
      expires_in: oauth.expiresIn,
      refresh_token: refreshToken,
      refresh_token_expires_in: 15_811_200,
      token_type: 'bearer',
    })
  }

  function tokenEndpoint(body: Record<string, string>): GithubFetchResponse {
    oauth.exchanges.push(body)
    if (
      body.client_id !== oauth.clientId ||
      body.client_secret !== oauth.clientSecret
    ) {
      return respond(200, {
        error: 'incorrect_client_credentials',
        error_description:
          'The client_id and/or client_secret passed are incorrect.',
      })
    }
    if (body.grant_type === 'refresh_token') {
      const login = refreshTokens.get(body.refresh_token ?? '')
      if (!login) {
        return respond(200, {
          error: 'bad_refresh_token',
          error_description:
            'The refresh token passed is incorrect or expired.',
        })
      }
      refreshTokens.delete(body.refresh_token!)
      return issueTokens(login)
    }
    const login = codes.get(body.code ?? '')
    if (!login) {
      return respond(200, {
        error: 'bad_verification_code',
        error_description: 'The code passed is incorrect or expired.',
      })
    }
    codes.delete(body.code!)
    return issueTokens(login)
  }

  /** Checks an App JWT. Returns a failure response, or `undefined` when it is valid. */
  function checkJwt(token: string): GithubFetchResponse | undefined {
    const bad = respond(401, {
      message: 'A JSON web token could not be decoded',
    })
    const parts = token.split('.')
    if (parts.length !== 3 || !options.app) {
      return bad
    }
    try {
      const header = JSON.parse(
        Buffer.from(parts[0]!, 'base64url').toString('utf8')
      )
      const payload = JSON.parse(
        Buffer.from(parts[1]!, 'base64url').toString('utf8')
      )
      if (
        header.alg !== 'RS256' ||
        payload.iss !== options.app.id ||
        payload.exp <= clock() / 1000
      ) {
        return bad
      }
      if (options.app.publicKey) {
        const verifier = createVerify('RSA-SHA256')
        verifier.update(`${parts[0]}.${parts[1]}`)
        if (
          !verifier.verify(
            options.app.publicKey,
            Buffer.from(parts[2]!, 'base64url')
          )
        ) {
          return bad
        }
      }
      appCalls.jwts.push(payload)
      return undefined
    } catch {
      return bad
    }
  }

  const fetch: GithubFetch = async (url, init) => {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
    if (failure) {
      const stub = failure
      failure = undefined
      return respond(
        stub.status,
        stub.body ?? { message: 'Failure' },
        stub.headers
      )
    }
    const { pathname, host } = new URL(url)
    const bearer = (header(init, 'Authorization') ?? '').replace(/^Bearer /, '')

    if (
      host === 'github.com' &&
      init.method === 'POST' &&
      pathname === '/login/oauth/access_token'
    ) {
      return tokenEndpoint(JSON.parse(init.body ?? '{}'))
    }

    if (init.method === 'GET' && pathname === '/user') {
      const login = userTokens.get(bearer)
      if (!login) {
        return respond(401, { message: 'Bad credentials' })
      }
      const user = users[login]!
      return respond(200, {
        id: user.id ?? 1,
        login,
        name: user.name ?? null,
        avatar_url: `https://avatars.example/${login}.png`,
      })
    }

    if (init.method === 'GET' && pathname === `/repos/${repo}`) {
      const login = userTokens.get(bearer)
      if (!login) {
        return respond(401, { message: 'Bad credentials' })
      }
      const user = users[login]!
      const role = user.permission
      if (user.installed === false || (role === 'none' && isPrivate)) {
        return respond(404, { message: 'Not Found' })
      }
      const rank = [
        'none',
        'read',
        'triage',
        'push',
        'maintain',
        'admin',
      ].indexOf(role)
      return respond(200, {
        name: repo.split('/')[1],
        private: isPrivate,
        permissions: {
          admin: rank >= 5,
          maintain: rank >= 4,
          push: rank >= 3,
          triage: rank >= 2,
          pull: rank >= 1 || !isPrivate,
        },
      })
    }

    if (init.method === 'GET' && pathname === `/repos/${repo}/installation`) {
      const denied = checkJwt(bearer)
      if (denied) {
        return denied
      }
      appCalls.lookups++
      return options.app?.installationId === undefined
        ? respond(404, { message: 'Not Found' })
        : respond(200, { id: options.app.installationId })
    }

    const tokenMatch = /^\/app\/installations\/(\d+)\/access_tokens$/.exec(
      pathname
    )
    if (init.method === 'POST' && tokenMatch) {
      const denied = checkJwt(bearer)
      if (denied) {
        return denied
      }
      if (Number(tokenMatch[1]) !== options.app?.installationId) {
        return respond(404, { message: 'Not Found' })
      }
      appCalls.tokenRequests.push(JSON.parse(init.body ?? '{}'))
      const token = `ghs_${randomBytes(8).toString('hex')}`
      installTokens.add(token)
      return respond(201, {
        token,
        expires_at: new Date(clock() + appTokenTtl * 1000).toISOString(),
      })
    }

    if (
      init.method === 'GET' &&
      pathname === `/repos/${repo}/commits/${branch}`
    ) {
      const etag = `"${headOid}"`
      if (header(init, 'If-None-Match') === etag) {
        calls.headNotModified++
        return respond(304, undefined, { ETag: etag })
      }
      calls.head++
      return respond(200, headOid, { ETag: etag })
    }

    const contentsPrefix = `/repos/${repo}/contents/`
    if (init.method === 'GET' && pathname.startsWith(contentsPrefix)) {
      const path = decodeURIComponent(pathname.slice(contentsPrefix.length))
      const base64 =
        raw.get(path) ??
        (files.has(path) ? Buffer.from(files.get(path)!, 'utf8').toString('base64') : undefined)
      if (base64 === undefined || !header(init, 'Accept')?.includes('.raw')) {
        return respond(404, { message: 'Not Found' })
      }
      const bytes = Buffer.from(base64, 'base64')
      return respond(200, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length))
    }

    if (init.method === 'POST' && pathname.endsWith('/graphql')) {
      calls.graphql++
      calls.graphqlTokens.push(bearer)
      const { query, variables } = JSON.parse(init.body ?? '{}') as {
        query: string
        variables: Record<string, any>
      }

      if (query.includes('createCommitOnBranch')) {
        calls.commit++
        const input = variables.input
        if (
          input.branch.repositoryNameWithOwner !== repo ||
          input.branch.branchName !== branch
        ) {
          return graphqlError('NOT_FOUND', 'Could not resolve to a Ref.')
        }
        if (input.expectedHeadOid !== headOid) {
          return graphqlError(
            'STALE_DATA',
            `Expected branch to point to "${input.expectedHeadOid}" but it did not. Pull and try again.`
          )
        }
        for (const deletion of input.fileChanges.deletions ?? []) {
          files.delete(deletion.path)
          raw.delete(deletion.path)
        }
        for (const addition of input.fileChanges.additions ?? []) {
          raw.set(addition.path, addition.contents)
          files.set(
            addition.path,
            Buffer.from(addition.contents, 'base64').toString('utf8')
          )
        }
        headOid = snapshot()
        return respond(200, {
          data: { createCommitOnBranch: { commit: { oid: headOid } } },
        })
      }

      const object = resolveObject(variables.expression)
      if (query.includes('entries')) {
        calls.tree++
        const entries = object?.kind === 'tree' ? object.entries : undefined
        return respond(200, {
          data: { repository: { object: entries ? { entries } : null } },
        })
      }
      calls.blob++
      const node =
        object?.kind === 'blob' ? blobNode(object.path, object.text) : null
      return respond(200, { data: { repository: { object: node } } })
    }

    return respond(404, { message: 'Not Found' })
  }

  return {
    fetch,
    calls,
    repo,
    branch,
    oauth,
    appCalls,
    installTokens,
    /** Adds a user, or changes the role of one. */
    setUser(login: string, user: FakeGithubUser) {
      users[login] = user
    },
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
