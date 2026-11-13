export const PLUTO_MAIL_REGIONS = [
  'us-east-1',
  'eu-west-1',
  'sa-east-1',
  'ap-northeast-1',
] as const

export function isPlutoMailAddress(value: string): boolean {
  if (value.length > 254 || /[\s<>,;]/.test(value)) {
    return false
  }
  const parts = value.split('@')
  return (
    parts.length === 2 &&
    parts[0]!.length > 0 &&
    parts[1]!.includes('.') &&
    !parts[1]!.startsWith('.') &&
    !parts[1]!.endsWith('.')
  )
}

export function isPlutoMailDomain(value: string): boolean {
  if (value.length > 253) {
    return false
  }
  const labels = value.split('.')
  return (
    labels.length >= 2 &&
    labels.every(
      (label) =>
        label.length > 0 &&
        label.length <= 63 &&
        /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
    ) &&
    /^[a-z]{2,63}$/.test(labels.at(-1)!)
  )
}

export function plutoMailEnvLine(name: string, value: string): string {
  if (/^[\w@.:/+-]*$/.test(value)) {
    return `${name}=${value}`
  }
  return `${name}="${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

export type PlutoMailDomainState = 'verified' | 'pending' | 'failed'

export function plutoMailDomainState(status: string): PlutoMailDomainState {
  if (status === 'verified') {
    return 'verified'
  }
  if (status === 'failed' || status === 'partially_failed') {
    return 'failed'
  }
  return 'pending'
}

export const PLUTO_MAIL_POLL_LIMIT_MS = 10 * 60 * 1000

export function plutoMailPollDelay(elapsedMs: number): number | null {
  if (elapsedMs >= PLUTO_MAIL_POLL_LIMIT_MS) {
    return null
  }
  if (elapsedMs < 60_000) {
    return 10_000
  }
  if (elapsedMs < 180_000) {
    return 20_000
  }
  if (elapsedMs < 300_000) {
    return 30_000
  }
  return 60_000
}

export type PlutoMailPollStop = 'done' | 'timeout' | 'stopped'

export interface PlutoMailPollerOptions {
  /** Runs one check. Return true when the work is done. A throw is a failed check: the poll goes on. */
  check: () => Promise<boolean>
  /** Called once when the poll ends. */
  onStop?: (reason: PlutoMailPollStop) => void
  /** Default: `Date.now`. */
  now?: () => number
}

export function createPlutoMailPoller(options: PlutoMailPollerOptions) {
  const now = options.now ?? Date.now
  let timer: ReturnType<typeof setTimeout> | undefined
  let startedAt = 0
  let running = false

  function finish(reason: PlutoMailPollStop) {
    if (!running) {
      return
    }
    running = false
    clearTimeout(timer)
    timer = undefined
    options.onStop?.(reason)
  }

  function schedule() {
    const delay = plutoMailPollDelay(now() - startedAt)
    if (delay === null) {
      finish('timeout')
      return
    }
    timer = setTimeout(tick, delay)
  }

  async function tick() {
    if (!running) {
      return
    }
    let done = false
    try {
      done = await options.check()
    } catch {
      // A failed check is not the end. The next one may work.
    }
    // `stop()` can run while the check waits.
    if (!running) {
      return
    }
    if (done) {
      finish('done')
    } else {
      schedule()
    }
  }

  return {
    start() {
      finish('stopped')
      running = true
      startedAt = now()
      schedule()
    },
    stop() {
      finish('stopped')
    },
    isRunning: () => running,
  }
}

export function plutoMailErrorCode(error: unknown): string | undefined {
  const asRecord = (value: unknown) =>
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : undefined
  const data = asRecord(asRecord(error)?.data)

  for (const candidate of [
    asRecord(data?.mail),
    asRecord(asRecord(data?.data)?.mail),
  ]) {
    if (typeof candidate?.code === 'string') {
      return candidate.code
    }
  }
  return undefined
}
