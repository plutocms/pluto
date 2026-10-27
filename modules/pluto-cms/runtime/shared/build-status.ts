/**
 * The build status of the head commit of the content branch. This file is pure.
 * The server route reads GitHub and calls `reduceBuildStatus`. The browser
 * code reads `shouldPoll` and `pollDelay`. A plain Vitest run can test it all.
 */

/** The state of one item, or of the whole commit. `none` means the host reports nothing. */
export type PlutoBuildState = 'none' | 'pending' | 'success' | 'failure'

export type PlutoBuildItemState = Exclude<PlutoBuildState, 'none'>

/** Where an item came from: a check run (GitHub Actions, apps), a commit status, or a deployment. */
export type PlutoBuildItemKind = 'check' | 'status' | 'deployment'

export interface PlutoBuildItem {
  kind: PlutoBuildItemKind
  name: string
  state: PlutoBuildItemState
  /** The page of the Action run or of the build. Only an http or https URL. */
  url?: string
  startedAt?: string
  completedAt?: string
  description?: string
}

/** The answer of `GET /api/_pluto/cms/build-status`. */
export interface PlutoBuildStatus {
  sha: string
  shortSha: string
  /** The first line of the commit message. */
  message: string
  committedAt?: string
  state: PlutoBuildState
  items: PlutoBuildItem[]
  /** The sources that GitHub refused to read, for example `checks` when the App lacks the permission. */
  unavailable?: PlutoBuildItemKind[]
}

/** The part of a GitHub check run that the reducer reads. */
export interface RawCheckRun {
  name?: string
  status?: string
  conclusion?: string | null
  html_url?: string | null
  details_url?: string | null
  started_at?: string | null
  completed_at?: string | null
  output?: {
 title?: string | null
} | null
}

/** The part of a GitHub commit status that the reducer reads. */
export interface RawCommitStatus {
  context?: string
  state?: string
  target_url?: string | null
  description?: string | null
  created_at?: string | null
  updated_at?: string | null
}

/** A deployment with its latest status. */
export interface RawDeployment {
  id?: number
  environment?: string
  description?: string | null
  created_at?: string | null
  updated_at?: string | null
  /** The latest status of the deployment, when it has one. */
  status?: {
    state?: string
    description?: string | null
    log_url?: string | null
    target_url?: string | null
    environment_url?: string | null
    created_at?: string | null
  } | null
}

export interface BuildStatusSources {
  checkRuns?: RawCheckRun[]
  statuses?: RawCommitStatus[]
  deployments?: RawDeployment[]
}

/** Keeps an http or https URL. A `javascript:` URL or a bad value gives `undefined`. */
export function safeHttpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value === '') {
    return undefined
  }
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

function text(value: unknown, max = 300): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim().slice(0, max) : undefined
}

function time(value: unknown): string | undefined {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : undefined
}

/**
 * A check run is pending until it is completed. A completed run is a success
 * for `success`, `neutral` and `skipped`. Every other conclusion (`failure`,
 * `cancelled`, `timed_out`, `action_required`, `startup_failure`, `stale`) is
 * a failure. A completed run with no conclusion counts as a failure.
 */
export function checkRunState(run: RawCheckRun): PlutoBuildItemState {
  if (run.status !== 'completed') {
    return 'pending'
  }
  return run.conclusion === 'success' || run.conclusion === 'neutral' || run.conclusion === 'skipped'
    ? 'success'
    : 'failure'
}

/** A commit status: `success` is a success, `pending` is pending, `failure` and `error` fail. Unknown values are pending. */
export function commitStatusState(state: string | undefined): PlutoBuildItemState {
  if (state === 'success') {
    return 'success'
  }
  return state === 'failure' || state === 'error' ? 'failure' : 'pending'
}

/**
 * A deployment status: `success` and `inactive` (replaced by a newer
 * deployment) are a success, `failure` and `error` fail. `queued`, `pending`,
 * `in_progress` and a deployment with no status yet are pending.
 */
export function deploymentState(state: string | undefined): PlutoBuildItemState {
  if (state === 'success' || state === 'inactive') {
    return 'success'
  }
  return state === 'failure' || state === 'error' ? 'failure' : 'pending'
}

/** The newest deployment of each environment, in the order of the first appearance. */
function latestDeployments(deployments: RawDeployment[]): RawDeployment[] {
  const byEnvironment = new Map<string, RawDeployment>()
  for (const deployment of deployments) {
    const key = deployment.environment ?? ''
    const current = byEnvironment.get(key)
    const at = Date.parse(deployment.created_at ?? '') || 0
    if (!current || at > (Date.parse(current.created_at ?? '') || 0)) {
      byEnvironment.set(key, deployment)
    }
  }
  return [...byEnvironment.values()]
}

/** Turns the three GitHub sources into one list of items. */
export function buildStatusItems(sources: BuildStatusSources): PlutoBuildItem[] {
  const items: PlutoBuildItem[] = []

  for (const run of sources.checkRuns ?? []) {
    items.push({
      kind: 'check',
      name: text(run.name, 120) ?? 'Check',
      state: checkRunState(run),
      url: safeHttpUrl(run.html_url) ?? safeHttpUrl(run.details_url),
      startedAt: time(run.started_at),
      completedAt: time(run.completed_at),
      description: text(run.output?.title),
    })
  }

  for (const status of sources.statuses ?? []) {
    const state = commitStatusState(status.state)
    items.push({
      kind: 'status',
      name: text(status.context, 120) ?? 'Status',
      state,
      url: safeHttpUrl(status.target_url),
      startedAt: time(status.created_at),
      completedAt: state === 'pending' ? undefined : time(status.updated_at),
      description: text(status.description),
    })
  }

  for (const deployment of latestDeployments(sources.deployments ?? [])) {
    const latest = deployment.status
    const state = deploymentState(latest?.state)
    items.push({
      kind: 'deployment',
      name: text(deployment.environment, 120) ?? 'Deployment',
      state,
      url: safeHttpUrl(latest?.log_url) ?? safeHttpUrl(latest?.target_url) ?? safeHttpUrl(latest?.environment_url),
      startedAt: time(deployment.created_at),
      completedAt: state === 'pending' ? undefined : time(latest?.created_at ?? deployment.updated_at),
      description: text(latest?.description) ?? text(deployment.description),
    })
  }

  return items
}

/**
 * The state of the commit. `none` when there is no item. `pending` while any
 * item is pending. Else `failure` when any item failed. Else `success`.
 */
export function reduceBuildState(items: Pick<PlutoBuildItem, 'state'>[]): PlutoBuildState {
  if (items.length === 0) {
    return 'none'
  }
  if (items.some((item) => item.state === 'pending')) {
    return 'pending'
  }
  return items.some((item) => item.state === 'failure') ? 'failure' : 'success'
}

/** The whole reducer: the three sources in, the state and the items out. */
export function reduceBuildStatus(sources: BuildStatusSources): {
 state: PlutoBuildState
items: PlutoBuildItem[]
} {
  const items = buildStatusItems(sources)
  return { state: reduceBuildState(items), items }
}

/** The first line of a commit message, cut to 200 characters. */
export function commitHeadline(message: unknown): string {
  const first = typeof message === 'string' ? (message.split('\n')[0] ?? '') : ''
  return first.trim().slice(0, 200)
}

// --- Polling rules (browser) -------------------------------------------------

/** How often the browser asks while a build runs. */
export const BUILD_POLL_INTERVAL_MS = 5_000
/** The browser stops after this time. */
export const BUILD_POLL_MAX_MS = 15 * 60_000
/**
 * After a save, GitHub needs some seconds to create the checks. In this time
 * an answer of `none` is not final, so the browser keeps asking.
 */
export const BUILD_POLL_GRACE_MS = 60_000

/**
 * True when the browser must ask again. It does not ask when the page is
 * hidden, after `BUILD_POLL_MAX_MS` from `startedAt`, or when the state is
 * final. `none` is final once the grace time after a save is over.
 */
export function shouldPoll(options: {
  state: PlutoBuildState | undefined
  /** Epoch ms when this run of polling started (open or save). */
  startedAt: number
  now: number
  hidden: boolean
  /** True after a save. It turns on the grace time for `none`. */
  afterSave?: boolean
}): boolean {
  if (options.hidden) {
    return false
  }
  const age = options.now - options.startedAt
  if (age >= BUILD_POLL_MAX_MS) {
    return false
  }
  if (options.state === undefined || options.state === 'pending') {
    return true
  }
  return options.state === 'none' && options.afterSave === true && age < BUILD_POLL_GRACE_MS
}
