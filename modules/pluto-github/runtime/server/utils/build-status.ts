import type { H3Event } from 'h3'
import type {
  PlutoBuildItemKind,
  PlutoBuildStatus,
  RawCheckRun,
  RawCommitStatus,
  RawDeployment,
} from '../../shared/build-status'
import { setResponseHeader } from 'h3'
import { createPlutoError } from '../../../../../server/utils/pluto-error'
import { commitHeadline, reduceBuildStatus } from '../../shared/build-status'
import { githubRest } from '../github/client'
import { PlutoGithubStoreError } from '../store/errors'
import { getGithubConfig } from './github-config'
import { requireGithubSession } from './session'

/** Milliseconds that the sources of one commit stay in memory, for each user. */
const SOURCES_TTL_MS = 3_000
const MAX_ENTRIES = 200
/** The most environments that the route reads. Each one costs one GitHub call. */
const MAX_DEPLOYMENTS = 5

interface Sources {
  checkRuns: RawCheckRun[]
  statuses: RawCommitStatus[]
  deployments: RawDeployment[]
  unavailable: PlutoBuildItemKind[]
}

interface Request {
  token: string
  apiUrl: string
  fetch: ReturnType<typeof getGithubConfig>['fetch']
}

const cache = new Map<string, {
 at: number
value: Promise<Sources>
}>()

/** Forgets the cached sources. A test calls this. */
export function clearBuildStatusCache(): void {
  cache.clear()
}

interface RawCommit {
  sha?: string
  commit?: {
 message?: string
committer?: {
 date?: string
} | null
author?: {
 date?: string
} | null
}
}

/**
 * Reads one source. A 403 or a 404 means that the App cannot read it (the
 * permission is missing), so the source counts as unavailable. Any other error
 * goes up.
 */
async function readSource<T>(kind: PlutoBuildItemKind, unavailable: PlutoBuildItemKind[], read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read()
  } catch (error) {
    if (error instanceof PlutoGithubStoreError && (error.code === 'forbidden' || error.code === 'not-found')) {
      unavailable.push(kind)
      return fallback
    }
    throw error
  }
}

async function loadSources(repo: string, sha: string, request: Request): Promise<Sources> {
  const unavailable: PlutoBuildItemKind[] = []
  const get = <T>(path: string) => githubRest<T>(`/repos/${repo}${path}`, request).then((result) => result.data)

  const [checkRuns, statuses, deployments] = await Promise.all([
    readSource('check', unavailable, async () => {
      const data = await get<{
 check_runs?: RawCheckRun[]
}>(`/commits/${sha}/check-runs?per_page=100`)
      return data?.check_runs ?? []
    }, [] as RawCheckRun[]),
    readSource('status', unavailable, async () => {
      const data = await get<{
 statuses?: RawCommitStatus[]
}>(`/commits/${sha}/status?per_page=100`)
      return data?.statuses ?? []
    }, [] as RawCommitStatus[]),
    readSource('deployment', unavailable, async () => {
      const list = await get<RawDeployment[]>(`/deployments?sha=${sha}&per_page=20`)
      // The newest deployment of each environment only.
      const newest = new Map<string, RawDeployment>()
      for (const deployment of Array.isArray(list) ? list : []) {
        const key = deployment.environment ?? ''
        const current = newest.get(key)
        if (!current || Date.parse(deployment.created_at ?? '') > Date.parse(current.created_at ?? '')) {
          newest.set(key, deployment)
        }
      }
      return Promise.all([...newest.values()].slice(0, MAX_DEPLOYMENTS).map(async (deployment) => {
        const latest = await get<NonNullable<RawDeployment['status']>[]>(`/deployments/${deployment.id}/statuses?per_page=1`)
        return { ...deployment, status: Array.isArray(latest) ? (latest[0] ?? null) : null }
      }))
    }, [] as RawDeployment[]),
  ])

  return { checkRuns, statuses, deployments, unavailable }
}

/** Maps an error of the GitHub call to an HTTP error, like the content adapter does. */
function toHttpError(error: unknown, event: H3Event): unknown {
  if (!(error instanceof PlutoGithubStoreError)) {
    return error
  }
  switch (error.code) {
    case 'auth':
      return createPlutoError({
        statusCode: 401,
        message: 'GitHub did not accept the sign-in. Sign in again.',
        key: 'pluto.github.errors.githubAuth',
      })
    case 'rate-limit': {
      const retryAfter = error.retryAfter === undefined ? undefined : Math.max(1, Math.ceil(error.retryAfter))
      if (retryAfter !== undefined) {
        setResponseHeader(event, 'Retry-After', retryAfter)
      }
      return createPlutoError({
        statusCode: 503,
        message: 'GitHub is limiting requests. Try again soon.',
        key: 'pluto.github.errors.rateLimited',
        data: { retryAfter },
      })
    }
    case 'forbidden':
      return createPlutoError({
        statusCode: 403,
        message: 'GitHub says you cannot do this in the repo.',
        key: 'pluto.github.errors.githubForbidden',
      })
    default:
      console.error('[pluto-github] GitHub error:', error)
      return createPlutoError({
        statusCode: 502,
        message: 'GitHub did not answer as expected.',
        key: 'pluto.github.errors.githubUnavailable',
      })
  }
}

/**
 * Route: GET /api/_pluto/github/build-status. The state of the builds of the head
 * commit of the content branch: check runs, commit statuses and deployments.
 * It needs a signed-in user and reads with the token of that user. The `fs`
 * store has no builds, so it answers `none`.
 */
export async function handleBuildStatus(event: H3Event): Promise<PlutoBuildStatus> {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const session = await requireGithubSession(event)
  const config = getGithubConfig()

  if (config.storage !== 'github') {
    return { sha: '', shortSha: '', message: '', state: 'none', items: [] }
  }

  const request: Request = { token: session.token, apiUrl: config.apiUrl, fetch: config.fetch }
  try {
    const { data: commit } = await githubRest<RawCommit>(
      `/repos/${config.repo}/commits/${encodeURIComponent(config.branch)}`,
      request
    )
    const sha = String(commit?.sha ?? '')
    if (!/^[0-9a-f]{7,64}$/i.test(sha)) {
      throw new PlutoGithubStoreError('github', 'GitHub sent a commit with no valid sha.')
    }

    // A few seconds of memory for each user and sha: several tabs share one set of calls.
    const key = `${session.user.id}:${config.repo}:${sha}`
    const now = Date.now()
    let entry = cache.get(key)
    if (!entry || now - entry.at > SOURCES_TTL_MS) {
      if (cache.size >= MAX_ENTRIES) {
        cache.delete(cache.keys().next().value as string)
      }
      const created = { at: now, value: loadSources(config.repo, sha, request) }
      entry = created
      cache.set(key, created)
      // A failed read must not stay in memory.
      created.value.catch(() => {
        if (cache.get(key) === created) {
          cache.delete(key)
        }
      })
    }
    const sources = await entry.value

    const { state, items } = reduceBuildStatus(sources)
    return {
      sha,
      shortSha: sha.slice(0, 7),
      message: commitHeadline(commit?.commit?.message),
      committedAt: commit?.commit?.committer?.date ?? commit?.commit?.author?.date ?? undefined,
      state,
      items,
      ...(sources.unavailable.length > 0 ? { unavailable: sources.unavailable } : {}),
    }
  } catch (error) {
    throw toHttpError(error, event)
  }
}
