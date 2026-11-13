import type { PlutoBuildStatus } from './build-status'
import {
  BUILD_POLL_INTERVAL_MS,
  BUILD_POLL_MAX_MS,
  shouldPoll,
} from './build-status'

const MAX_BACKOFF_MS = 60_000
const MAX_ERRORS = 5

export interface BuildPollerOptions {
  load: () => Promise<PlutoBuildStatus>
  onStatus: (status: PlutoBuildStatus) => void
  onError?: (error: unknown) => void
  isHidden: () => boolean
  now?: () => number
}

export interface BuildPoller {
  start: (options?: { afterSave?: boolean }) => void
  stop: () => void
  resume: () => void
}

function statusCodeOf(error: unknown): number | undefined {
  const value = error as {
    statusCode?: number
    status?: number
  } | null
  return value?.statusCode ?? value?.status
}

export function createBuildPoller(options: BuildPollerOptions): BuildPoller {
  const now = options.now ?? Date.now
  let timer: ReturnType<typeof setTimeout> | undefined
  let run = 0
  let startedAt = 0
  let afterSave = false
  let errors = 0

  function clear() {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  function schedule(delay: number, current: number) {
    clear()
    timer = setTimeout(() => {
      timer = undefined
      void tick(current)
    }, delay)
  }

  async function tick(current: number) {
    if (current !== run) {
      return
    }
    if (options.isHidden() || now() - startedAt >= BUILD_POLL_MAX_MS) {
      return
    }
    try {
      const status = await options.load()
      if (current !== run) {
        return
      }
      errors = 0
      options.onStatus(status)
      if (
        shouldPoll({
          state: status.state,
          startedAt,
          now: now(),
          hidden: options.isHidden(),
          afterSave,
        })
      ) {
        schedule(BUILD_POLL_INTERVAL_MS, current)
      }
    } catch (error) {
      if (current !== run) {
        return
      }
      options.onError?.(error)
      const code = statusCodeOf(error)
      errors++
      if (code === 401 || code === 403 || errors >= MAX_ERRORS) {
        return
      }
      if (
        shouldPoll({
          state: undefined,
          startedAt,
          now: now(),
          hidden: options.isHidden(),
        })
      ) {
        schedule(
          Math.min(BUILD_POLL_INTERVAL_MS * 2 ** errors, MAX_BACKOFF_MS),
          current
        )
      }
    }
  }

  function start(
    startOptions: {
      afterSave?: boolean
    } = {}
  ) {
    clear()
    run++
    startedAt = now()
    afterSave = startOptions.afterSave === true
    errors = 0
    void tick(run)
  }

  return {
    start,
    stop() {
      clear()
      run++
    },
    resume() {
      start()
    },
  }
}
