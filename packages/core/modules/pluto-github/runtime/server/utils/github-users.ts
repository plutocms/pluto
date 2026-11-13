import type { H3Event } from 'h3'
import type {
  GithubCollaborator,
  PlutoGithubUsersResponse,
} from '../../shared/repo-users'
import type { AppTokenProvider } from '../github/app-token'
import type { GithubConfig } from './github-config'
import { setResponseHeader } from 'h3'
import { toRepoUsers } from '../../shared/repo-users'
import { createAppTokenProvider } from '../github/app-token'
import { githubRest } from '../github/client'
import { toHttpError } from './build-status'
import { getGithubConfig } from './github-config'
import { requireGithubSession } from './session'

const MAX_PAGES = 10
const CACHE_TTL = 30_000

const cache = new Map<string, { at: number; value: PlutoGithubUsersResponse }>()
let appTokens: { key: string; provider: AppTokenProvider } | undefined

export function clearGithubUsersCache(): void {
  cache.clear()
  appTokens = undefined
}

export function localReadToken(config: GithubConfig): Promise<string> {
  const key = [config.repo, config.appId, config.apiUrl, config.readToken].join(
    '\n'
  )
  if (appTokens?.key !== key) {
    appTokens = {
      key,
      provider: createAppTokenProvider({
        repo: config.repo,
        apiUrl: config.apiUrl,
        appId: config.appId,
        privateKey: config.privateKey,
        readToken: config.readToken,
        fetch: config.fetch,
      }),
    }
  }
  return appTokens.provider.getReadToken()
}

async function listCollaborators(
  config: GithubConfig,
  token: string
): Promise<GithubCollaborator[]> {
  const all: GithubCollaborator[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data } = await githubRest<GithubCollaborator[]>(
      `/repos/${config.repo}/collaborators?affiliation=all&permission=push&per_page=100&page=${page}`,
      { apiUrl: config.apiUrl, fetch: config.fetch, token }
    )
    all.push(...(data ?? []))
    if (!data || data.length < 100) {
      break
    }
  }
  return all
}

export async function handleGithubUsers(
  event: H3Event
): Promise<PlutoGithubUsersResponse> {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const session = await requireGithubSession(event)
  const config = getGithubConfig()
  const restricted = config.allowedUsers.length > 0
  const base = { repo: config.repo, users: [], restricted }

  if (!config.repo) {
    return { ...base, reason: 'no-repo' }
  }
  const local = config.storage === 'fs' || session.local === true
  if (local && !config.readToken && !(config.appId && config.privateKey)) {
    return { ...base, reason: 'no-app' }
  }

  const cached = cache.get(config.repo)
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return cached.value
  }

  let token = session.token
  if (local) {
    try {
      token = await localReadToken(config)
    } catch {
      return { ...base, reason: 'app-error' }
    }
  }

  try {
    const users = toRepoUsers(
      await listCollaborators(config, token),
      config.allowedUsers
    )
    const value: PlutoGithubUsersResponse = { ...base, users }
    cache.set(config.repo, { at: Date.now(), value })
    return value
  } catch (error) {
    throw toHttpError(error, event)
  }
}
