import type { PlutoBuildStatus } from './build-status'
import {
  BUILD_POLL_INTERVAL_MS,
  BUILD_POLL_MAX_MS,
  shouldPoll,
} from './build-status'

/** The most seconds between two tries after errors. */
const MAX_BACKOFF_MS = 60_000
/** The poller stops after this many errors in a row. */
const MAX_ERRORS = 5

export interface BuildPollerOptions {
  /** Reads the status once. */
  load: () => Promise<PlutoBuildStatus>
  onStatus: (status: PlutoBuildStatus) => void
  /** Called on a failed read. The poller goes on unless the error is 401 or 403. */
  onError?: (error: unknown) => void
  /** True while the page is hidden. The poller then does not call `load`. */
  isHidden: () => boolean
  now?: () => number
}

export interface BuildPoller {
  /**
   * Reads now, then keeps reading while the build is pending. `afterSave` gives
   * the checks some seconds to appear (an answer of `none` is not final yet).
   * It resets the 15-minute limit.
   */
  start: (options?: { afterSave?: boolean }) => void
  /** Stops all timers. A read in progress still ends, and its answer is dropped. */
  stop: () => void
  /** Call it when the page becomes visible. It reads again. */
  resume: () => void
}

function statusCodeOf(error: unknown): number | undefined {
  const value = error as {
    statusCode?: number
    status?: number
  } | null
  return value?.statusCode ?? value?.status
}

/**
 * The polling loop of the build status. It has no Vue and no DOM code, so a
 * test can drive it with fake timers. The rules are in `shouldPoll`.
 */
export function createBuildPoller(options: BuildPollerOptions): BuildPoller {
  const now = options.now ?? Date.now
  let timer: ReturnType<typeof setTimeout> | undefined
  // A new run (start, stop) makes older reads stale.
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
    // A hidden page asks nothing. `resume` starts again.
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
