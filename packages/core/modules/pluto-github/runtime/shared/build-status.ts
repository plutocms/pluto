export type PlutoBuildState = 'none' | 'pending' | 'success' | 'failure'

export type PlutoBuildItemState = Exclude<PlutoBuildState, 'none'>

export type PlutoBuildItemKind = 'check' | 'status' | 'deployment'

export interface PlutoBuildItem {
  kind: PlutoBuildItemKind
  name: string
  state: PlutoBuildItemState
  url?: string
  startedAt?: string
  completedAt?: string
  description?: string
}

export interface PlutoBuildStatus {
  sha: string
  shortSha: string
  message: string
  committedAt?: string
  state: PlutoBuildState
  items: PlutoBuildItem[]
  unavailable?: PlutoBuildItemKind[]
}

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

export interface RawCommitStatus {
  context?: string
  state?: string
  target_url?: string | null
  description?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface RawDeployment {
  id?: number
  environment?: string
  description?: string | null
  created_at?: string | null
  updated_at?: string | null
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

export function safeHttpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value === '') {
    return undefined
  }
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.toString()
      : undefined
  } catch {
    return undefined
  }
}

function text(value: unknown, max = 300): string | undefined {
  return typeof value === 'string' && value.trim() !== ''
    ? value.trim().slice(0, max)
    : undefined
}

function time(value: unknown): string | undefined {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
    ? value
    : undefined
}

export function checkRunState(run: RawCheckRun): PlutoBuildItemState {
  if (run.status !== 'completed') {
    return 'pending'
  }
  return run.conclusion === 'success' ||
    run.conclusion === 'neutral' ||
    run.conclusion === 'skipped'
    ? 'success'
    : 'failure'
}

export function commitStatusState(
  state: string | undefined
): PlutoBuildItemState {
  if (state === 'success') {
    return 'success'
  }
  return state === 'failure' || state === 'error' ? 'failure' : 'pending'
}

export function deploymentState(
  state: string | undefined
): PlutoBuildItemState {
  if (state === 'success' || state === 'inactive') {
    return 'success'
  }
  return state === 'failure' || state === 'error' ? 'failure' : 'pending'
}

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

export function buildStatusItems(
  sources: BuildStatusSources
): PlutoBuildItem[] {
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
      url:
        safeHttpUrl(latest?.log_url) ??
        safeHttpUrl(latest?.target_url) ??
        safeHttpUrl(latest?.environment_url),
      startedAt: time(deployment.created_at),
      completedAt:
        state === 'pending'
          ? undefined
          : time(latest?.created_at ?? deployment.updated_at),
      description: text(latest?.description) ?? text(deployment.description),
    })
  }

  return items
}

export function reduceBuildState(
  items: Pick<PlutoBuildItem, 'state'>[]
): PlutoBuildState {
  if (items.length === 0) {
    return 'none'
  }
  if (items.some((item) => item.state === 'pending')) {
    return 'pending'
  }
  return items.some((item) => item.state === 'failure') ? 'failure' : 'success'
}

export function reduceBuildStatus(sources: BuildStatusSources): {
  state: PlutoBuildState
  items: PlutoBuildItem[]
} {
  const items = buildStatusItems(sources)
  return { state: reduceBuildState(items), items }
}

export function hasSkipMarker(message: unknown): boolean {
  return (
    typeof message === 'string' &&
    /\[(?:skip ci|ci skip|no ci|skip actions|actions skip)\]/i.test(message)
  )
}

export function pickDeployCommit<
  T extends { commit?: { message?: string } | null },
>(commits: readonly T[]): T | undefined {
  return (
    commits.find((commit) => !hasSkipMarker(commit.commit?.message)) ??
    commits[0]
  )
}

export function commitHeadline(message: unknown): string {
  const first =
    typeof message === 'string' ? (message.split('\n')[0] ?? '') : ''
  return first.trim().slice(0, 200)
}

export const BUILD_POLL_INTERVAL_MS = 5_000
export const BUILD_POLL_MAX_MS = 15 * 60_000
export const BUILD_POLL_GRACE_MS = 60_000

export function shouldPoll(options: {
  state: PlutoBuildState | undefined
  startedAt: number
  now: number
  hidden: boolean
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
  return (
    options.state === 'none' &&
    options.afterSave === true &&
    age < BUILD_POLL_GRACE_MS
  )
}
