import type { H3Event } from 'h3'
import type {
  PlutoDeployStatus,
  PlutoPagesDomainBody,
  PlutoPagesDomainResult,
  PlutoPagesSetupResult,
  PlutoPagesState,
} from '../../shared/deploy'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { createError, getRequestHost, readBody, setResponseHeader } from 'h3'
import { createPlutoError } from '../../../../../server/utils/pluto-error'
import { normalizeDomain } from '../../shared/domain'
import {
  defaultPagesUrl,
  detectPackageManager,
  PAGES_WORKFLOW_PATH,
  renderPagesWorkflow,
} from '../../shared/pages-workflow'
import { commitLocalFiles } from '../store/local-git'
import { getGithubConfig } from './github-config'
import { isLocalRequest, requireGithubSession } from './session'

const run = promisify(execFile)

/** A repo name that is safe to put in a `gh api` path. */
const REPO_NAME = /^[\w.-]+\/[\w.-]+$/

async function gh(args: string[]): Promise<string> {
  const { stdout } = await run('gh', args, {
    windowsHide: true,
    timeout: 30_000,
    env: { ...process.env, GH_PROMPT_DISABLED: '1' },
  })
  return stdout
}

/** Sorts a failure of `gh` into a reason, and `off` for a 404. */
function ghFailure(error: unknown): PlutoPagesState {
  const failure = error as NodeJS.ErrnoException & { stderr?: string }
  if (failure.code === 'ENOENT') {
    return { state: 'unknown', reason: 'no-gh' }
  }
  const text = String(failure.stderr ?? failure.message ?? '')
  if (/HTTP 404|Not Found/i.test(text)) {
    return { state: 'off' }
  }
  if (/gh auth login|not logged in|authentication/i.test(text)) {
    return { state: 'unknown', reason: 'signed-out' }
  }
  return { state: 'unknown', reason: 'error' }
}

/** Reads the Pages site of the repo with `gh api`. It never throws. */
export async function readPagesState(repo: string): Promise<PlutoPagesState> {
  if (!REPO_NAME.test(repo)) {
    return { state: 'unknown', reason: 'error' }
  }
  try {
    const site = JSON.parse(await gh(['api', `repos/${repo}/pages`])) as {
      html_url?: string
      build_type?: string
      cname?: string | null
      https_certificate?: { state?: string } | null
      https_enforced?: boolean
    }
    return {
      state: 'on',
      url: site.html_url,
      source: site.build_type === 'workflow' ? 'workflow' : 'legacy',
      cname: site.cname ?? '',
      certificate: site.https_certificate?.state ?? '',
      httpsEnforced: Boolean(site.https_enforced),
    }
  } catch (error) {
    return ghFailure(error)
  }
}

/**
 * Turns Pages on for the repo with the Actions source (`build_type=workflow`), or moves a site
 * that builds from a branch to the Actions source. Needs `gh` signed in as a user who administers
 * the repo. Returns the new state.
 */
export async function enablePages(repo: string): Promise<PlutoPagesState> {
  const current = await readPagesState(repo)
  if (current.state === 'on' && current.source === 'workflow') {
    return current
  }
  if (current.state === 'unknown') {
    return current
  }
  try {
    await gh([
      'api',
      '-X',
      current.state === 'on' ? 'PUT' : 'POST',
      `repos/${repo}/pages`,
      '-f',
      'build_type=workflow',
    ])
  } catch (error) {
    return ghFailure(error)
  }
  return readPagesState(repo)
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

async function buildStatus(
  local: boolean,
  event?: H3Event
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
    pagesUrl: config.repo ? defaultPagesUrl(config.repo) : '',
    host: { id: config.host, site: config.hostSite },
  }
  if (!local && event) {
    status.siteHost = getRequestHost(event, { xForwardedHost: true })
  }
  if (local) {
    const file = join(root, PAGES_WORKFLOW_PATH)
    const exists = existsSync(file)
    status.workflow.exists = exists
    status.workflow.current = exists && (await readFile(file, 'utf8')) === text
    status.pages = config.repo
      ? await readPagesState(config.repo)
      : { state: 'unknown', reason: 'error' }
  }
  return status
}

/**
 * Route: GET /api/_pluto/github/deploy/status. The facts that the Deploy page needs: the repo,
 * the branch, and the GitHub Pages workflow to copy. In local mode on this computer it also says
 * whether the workflow is in the project and whether Pages is on (with `gh`). It needs a signed-in
 * user.
 */
export async function handleDeployStatus(
  event: H3Event
): Promise<PlutoDeployStatus> {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  await requireGithubSession(event)
  return buildStatus(isLocalMode(event), event)
}

/**
 * Route: POST /api/_pluto/github/deploy/pages. Local mode on this computer only (404 otherwise).
 * It writes the workflow when it is missing or old, commits it to the local repo, and turns Pages
 * on with `gh` (the Actions source). The author pushes to deploy.
 */
export async function handleSetupPages(
  event: H3Event
): Promise<PlutoPagesSetupResult> {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  if (!isLocalMode(event)) {
    throw createError({ statusCode: 404 })
  }
  const config = getGithubConfig()
  const before = await buildStatus(true)

  let committed = false
  if (!before.workflow.current) {
    const file = join(config.fsRoot, PAGES_WORKFLOW_PATH)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, before.workflow.text, 'utf8')
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

  const pages = config.repo
    ? await enablePages(config.repo)
    : ({ state: 'unknown', reason: 'error' } as PlutoPagesState)
  const status = await buildStatus(true)
  status.pages = pages
  return {
    status,
    committed,
    pagesOn: pages.state === 'on' && pages.source === 'workflow',
  }
}

/** Sorts a failed change of the Pages site into an error with an i18n key. */
function domainError(error: unknown): Error {
  const failure = error as NodeJS.ErrnoException & { stderr?: string }
  const text = String(failure.stderr ?? failure.message ?? '')
  const pages = ghFailure(error)
  const reason =
    failure.code === 'ENOENT'
      ? 'noGh'
      : pages.reason === 'signed-out'
        ? 'signedOut'
        : /already taken/i.test(text)
          ? 'taken'
          : /certificate/i.test(text)
            ? 'certificate'
            : 'failed'
  return createPlutoError({
    statusCode: reason === 'failed' ? 502 : 409,
    message: 'Could not change the GitHub Pages site.',
    key: `pluto.github.deploy.domain.errors.${reason}`,
  })
}

/**
 * Route: POST /api/_pluto/github/deploy/domain. Local mode on this computer only (404 otherwise).
 * It sets or removes the custom domain of the GitHub Pages site, or turns "Enforce HTTPS" on or
 * off, with `gh api`. GitHub ignores a `CNAME` file when an Action builds the site, so the domain
 * lives in the Pages settings only. A new domain changes the base path of the site, so Pluto starts
 * the workflow again.
 */
export async function handlePagesDomain(
  event: H3Event
): Promise<PlutoPagesDomainResult> {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  if (!isLocalMode(event)) {
    throw createError({ statusCode: 404 })
  }
  const config = getGithubConfig()
  const body: PlutoPagesDomainBody =
    (await readBody<PlutoPagesDomainBody | null>(event)) ?? {}
  if (!config.repo || !REPO_NAME.test(config.repo)) {
    throw createError({ statusCode: 409, statusMessage: 'No repo.' })
  }
  const current = await readPagesState(config.repo)
  if (current.state !== 'on') {
    throw createPlutoError({
      statusCode: 409,
      message: 'GitHub Pages is not on for the repo.',
      key: 'pluto.github.deploy.domain.errors.pagesOff',
    })
  }

  let field: string
  let changedDomain = false
  if (typeof body.domain === 'string') {
    const domain = normalizeDomain(body.domain)
    if (domain === null) {
      throw createPlutoError({
        statusCode: 400,
        message: 'This is not a domain.',
        key: 'pluto.github.deploy.domain.errors.invalid',
      })
    }
    // `-F` sends `null` as JSON null: GitHub removes the domain.
    field = domain ? `cname=${domain}` : 'cname=null'
    changedDomain = domain !== (current.cname ?? '')
  } else if (typeof body.httpsEnforced === 'boolean') {
    field = `https_enforced=${body.httpsEnforced}`
  } else {
    throw createError({
      statusCode: 400,
      statusMessage: 'Send domain or httpsEnforced.',
    })
  }

  try {
    await gh(['api', '-X', 'PUT', `repos/${config.repo}/pages`, '-F', field])
  } catch (error) {
    throw domainError(error)
  }

  let rebuilt = false
  if (changedDomain && current.source === 'workflow') {
    try {
      await gh([
        'workflow',
        'run',
        PAGES_WORKFLOW_PATH.split('/').at(-1)!,
        '-R',
        config.repo,
        '--ref',
        config.branch,
      ])
      rebuilt = true
    } catch {
      // The workflow is not on GitHub yet: the next push builds the site.
    }
  }

  const status = await buildStatus(true)
  return { status, rebuilt }
}
