/**
 * Pure helpers for the mail setup. The admin page and the mail routes share
 * them, so the browser and the server check a value the same way.
 */

/** The regions Resend offers for a domain. The first one is the default. */
export const PLUTO_MAIL_REGIONS = [
  'us-east-1',
  'eu-west-1',
  'sa-east-1',
  'ap-northeast-1',
] as const

/** True for a plausible email address. The provider does the real check. */
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

/** True for a domain name such as `example.com` or `mail.example.com.br`. Lowercase only. */
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

/**
 * Builds one `NAME=value` line for an `.env` file or a host panel. A value
 * with a character other than a letter, a digit or `@ . : / + _ -` gets
 * double quotes, and `\` and `"` inside it get a backslash.
 */
export function plutoMailEnvLine(name: string, value: string): string {
  if (/^[\w@.:/+-]*$/.test(value)) {
    return `${name}=${value}`
  }
  return `${name}="${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

export type PlutoMailDomainState = 'verified' | 'pending' | 'failed'

/**
 * Groups the Resend domain statuses: `verified` is done, `failed` and
 * `partially_failed` need a DNS fix, everything else is still waiting
 * (`not_started`, `pending`, `partially_verified`, `temporary_failure`).
 */
export function plutoMailDomainState(status: string): PlutoMailDomainState {
  if (status === 'verified') {
    return 'verified'
  }
  if (status === 'failed' || status === 'partially_failed') {
    return 'failed'
  }
  return 'pending'
}

/** The poll stops after 10 minutes. */
export const PLUTO_MAIL_POLL_LIMIT_MS = 10 * 60 * 1000

/**
 * The wait before the next domain check, given the time since the polling
 * started. 10 s at first, then slower up to 60 s. Returns null once the poll
 * limit passed: the page stops and shows a "Check again" button.
 */
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

/**
 * Polls a check on the `plutoMailPollDelay` schedule: 10 s, slower up to
 * 60 s, and a stop after 10 minutes. `start()` begins a new run and ends the
 * run before it. The first check comes after the first delay, so the caller
 * checks once by itself before it starts the poll.
 */
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

/**
 * Reads the mail error code that an admin mail route sent (`data.mail.code`)
 * out of a `$fetch` error. A `$fetch` error holds the response body in `data`,
 * so the code sits in `data.data.mail.code`. An error that Nuxt creates on the
 * client holds it in `data.mail.code`.
 */
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
