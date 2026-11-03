import type { H3Event } from 'h3'
import type {
  PlutoDeployStatus,
  PlutoDomainCheck,
  PlutoPagesDeploy,
  PlutoPagesSetupResult,
} from '../../shared/deploy'
import type { GithubConfig } from './github-config'
import { resolve4, resolve6, resolveCname } from 'node:dns/promises'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createError, getQuery, getRequestHost, setResponseHeader } from 'h3'
import { createPlutoError } from '../../../../../server/utils/pluto-error'
import {
  GITHUB_PAGES_A,
  GITHUB_PAGES_AAAA,
  normalizeDomain,
} from '../../shared/domain'
import {
  defaultPagesUrl,
  detectPackageManager,
  PAGES_WORKFLOW_PATH,
  renderPagesWorkflow,
} from '../../shared/pages-workflow'
import { githubRest } from '../github/client'
import { commitLocalFiles } from '../store/local-git'
import { getGithubConfig } from './github-config'
import { localReadToken } from './github-users'
import { isLocalRequest, requireGithubSession } from './session'

/** A repo name that is safe to put in an API path. */
const REPO_NAME = /^[\w.-]+\/[\w.-]+$/

interface RawDeployment {
  id: number
}

interface RawDeploymentStatus {
  state: string
  environment_url?: string
  log_url?: string
  target_url?: string
  created_at?: string
}

async function readDeploy(
  config: GithubConfig,
  token: string | undefined
): Promise<PlutoPagesDeploy> {
  const path = `/repos/${config.repo}/deployments`
  const options = { apiUrl: config.apiUrl, fetch: config.fetch, token }
  const { data } = await githubRest<RawDeployment[]>(
    `${path}?environment=github-pages&per_page=1`,
    options
  )
  const deployment = data?.[0]
  if (!deployment) {
    return { state: 'none' }
  }
  const { data: statuses } = await githubRest<RawDeploymentStatus[]>(
    `${path}/${deployment.id}/statuses?per_page=1`,
    options
  )
  const status = statuses?.[0]
  const state = status?.state ?? ''
  return {
    state:
      state === 'success' || state === 'inactive'
        ? 'success'
        : state === 'failure' || state === 'error'
          ? 'failure'
          : 'pending',
    url: status?.environment_url || undefined,
    logUrl: status?.log_url || status?.target_url || undefined,
    at: status?.created_at,
  }
}

/**
 * The last deploy to GitHub Pages, from the deployments of the `github-pages` environment. It
 * reads with the token first (a private repo needs one), then with no token (a public repo needs
 * none, and the App may not read deployments). It never throws.
 */
export async function readPagesDeploy(
  config: GithubConfig,
  token?: string
): Promise<PlutoPagesDeploy> {
  if (!REPO_NAME.test(config.repo)) {
    return { state: 'unknown' }
  }
  for (const auth of token ? [token, undefined] : [undefined]) {
    try {
      return await readDeploy(config, auth)
    } catch {
      // Try the next way, then give up.
    }
  }
  return { state: 'unknown' }
}

/** The local mode of this request: a dev build, the `fs` store, and this computer. */
function isLocalMode(event: H3Event): boolean {
  const config = getGithubConfig()
  return (
    config.dev &&
    config.storage === 'fs' &&
    Boolean(config.fsRoot) &&
    isLocalRequest(event)
  )
}

async function rootFiles(root: string): Promise<string[]> {
  try {
    return await readdir(root)
  } catch {
    return []
  }
}

/** The token to read the repo with: the user's, or in local mode the App or the read token. */
async function readToken(
  config: GithubConfig,
  local: boolean,
  sessionToken: string
): Promise<string | undefined> {
  if (!local) {
    return sessionToken || undefined
  }
  if (!config.readToken && !(config.appId && config.privateKey)) {
    return undefined
  }
  try {
    return await localReadToken(config)
  } catch {
    return undefined
  }
}

async function buildStatus(
  event: H3Event,
  local: boolean,
  token: string | undefined
): Promise<PlutoDeployStatus> {
  const config = getGithubConfig()
  const root = config.fsRoot
  const packageManager = detectPackageManager(
    local ? await rootFiles(root) : []
  )
  const text = renderPagesWorkflow({ branch: config.branch, packageManager })
  const status: PlutoDeployStatus = {
    repo: config.repo,
    branch: config.branch,
    local,
    packageManager,
    workflow: { path: PAGES_WORKFLOW_PATH, text },
    deploy: await readPagesDeploy(config, token),
    pagesUrl: config.repo ? defaultPagesUrl(config.repo) : '',
    host: { id: config.host, site: config.hostSite },
  }
  if (local) {
    const file = join(root, PAGES_WORKFLOW_PATH)
    const exists = existsSync(file)
    status.workflow.exists = exists
    status.workflow.current = exists && (await readFile(file, 'utf8')) === text
  } else {
    status.siteHost = getRequestHost(event, { xForwardedHost: true })
  }
  return status
}

/**
 * Route: GET /api/_pluto/github/deploy/status. The facts that the Deploy page needs: the repo,
 * the branch, the GitHub Pages workflow to copy, and the last deploy to GitHub Pages. In local
 * mode on this computer it also says whether the workflow is in the project. It needs a signed-in
 * user. It runs no CLI.
 */
export async function handleDeployStatus(
  event: H3Event
): Promise<PlutoDeployStatus> {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const session = await requireGithubSession(event)
  const local = isLocalMode(event)
  const token = await readToken(getGithubConfig(), local, session.token)
  return buildStatus(event, local, token)
}

/**
 * Route: POST /api/_pluto/github/deploy/pages. Local mode on this computer only (404 otherwise).
 * It writes the workflow when it is missing or old, and commits it to the local repo. It changes
 * nothing on GitHub: the author turns Pages on in the settings of the repo, then pushes.
 */
export async function handleSetupPages(
  event: H3Event
): Promise<PlutoPagesSetupResult> {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  if (!isLocalMode(event)) {
    throw createError({ statusCode: 404 })
  }
  const config = getGithubConfig()
  const file = join(config.fsRoot, PAGES_WORKFLOW_PATH)
  const text = renderPagesWorkflow({
    branch: config.branch,
    packageManager: detectPackageManager(await rootFiles(config.fsRoot)),
  })

  let committed = false
  const current = existsSync(file) && (await readFile(file, 'utf8')) === text
  if (!current) {
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, text, 'utf8')
    try {
      const result = await commitLocalFiles(
        config.fsRoot,
        [PAGES_WORKFLOW_PATH],
        'ci: deploy the site to GitHub Pages'
      )
      committed = result.committed
    } catch (error) {
      // The file is written. A hook or a missing author stops the commit only.
      console.warn('[pluto-github] Could not commit the Pages workflow.', error)
    }
  }

  const token = await readToken(config, true, '')
  return { status: await buildStatus(event, true, token), committed }
}

/**
 * Route: DELETE /api/_pluto/github/deploy/pages. Local mode on this computer only (404 otherwise).
 * It deletes the workflow and commits the removal to the local repo. It changes nothing on GitHub:
 * the push stops new builds, and the author unpublishes the site in the Pages settings of the repo.
 */
export async function handleRemovePages(
  event: H3Event
): Promise<PlutoPagesSetupResult> {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  if (!isLocalMode(event)) {
    throw createError({ statusCode: 404 })
  }
  const config = getGithubConfig()
  const file = join(config.fsRoot, PAGES_WORKFLOW_PATH)

  let committed = false
  if (existsSync(file)) {
    await unlink(file)
    try {
      const result = await commitLocalFiles(
        config.fsRoot,
        [PAGES_WORKFLOW_PATH],
        'ci: stop deploying the site to GitHub Pages'
      )
      committed = result.committed
    } catch (error) {
      // The file is gone. A hook or a missing author stops the commit only.
      console.warn(
        '[pluto-github] Could not commit the removal of the Pages workflow.',
        error
      )
    }
  }

  const token = await readToken(config, true, '')
  return { status: await buildStatus(event, true, token), committed }
}

const PAGES_ADDRESSES = new Set([...GITHUB_PAGES_A, ...GITHUB_PAGES_AAAA])

async function settle(lookup: Promise<string[]>): Promise<string[]> {
  try {
    return await lookup
  } catch {
    // No record of this kind, or no answer.
    return []
  }
}

/**
 * Checks the DNS of a custom domain for GitHub Pages: `ok` when every address of the domain is a
 * GitHub Pages address. A CNAME to `<owner>.github.io` gives these addresses too, so one rule
 * covers a subdomain and an apex domain.
 */
export async function checkPagesDomain(
  domain: string
): Promise<PlutoDomainCheck> {
  const [cnames, v4, v6] = await Promise.all([
    settle(resolveCname(domain)),
    settle(resolve4(domain)),
    settle(resolve6(domain)),
  ])
  const addresses = [...v4, ...v6]
  const found = [
    ...cnames.map((name) => name.toLowerCase().replace(/\.$/, '')),
    ...addresses,
  ]
  if (addresses.length === 0) {
    return { domain, state: found.length > 0 ? 'other' : 'missing', found }
  }
  return {
    domain,
    state: addresses.every((address) => PAGES_ADDRESSES.has(address))
      ? 'ok'
      : 'other',
    found,
  }
}

/**
 * Route: GET /api/_pluto/github/deploy/dns?domain=<domain>. A signed-in user only. It checks
 * whether the DNS records of a custom domain point to GitHub Pages, from the server, with no CLI.
 */
export async function handleDomainCheck(
  event: H3Event
): Promise<PlutoDomainCheck> {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  await requireGithubSession(event)
  const domain = normalizeDomain(String(getQuery(event).domain ?? ''))
  if (!domain) {
    throw createPlutoError({
      statusCode: 400,
      message: 'This is not a domain.',
      key: 'pluto.github.deploy.domain.errors.invalid',
    })
  }
  return checkPagesDomain(domain)
}
