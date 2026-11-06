import type { PlutoContentBackup } from '../../../shared/utils/content-backup'

// The client side of the server copy of a content backup: the rules for the requests, with no Nuxt
// and no DOM, so plain Vitest can test them. `PlutoContentForm` gets it through
// `usePlutoContentBackupServer`. See the content-backup skill.

/** The answer of the backup routes. */
export interface BackupAnswer {
  supported: boolean
  backup?: PlutoContentBackup | null
  otherDevice?: boolean
}

/** The answer of a GET. `null` when the server gave none (see `read` of `createBackupSync`). */
export type BackupRead = { record: PlutoContentBackup | null } | null

export type BackupRequest = (
  method: 'GET' | 'PUT' | 'DELETE',
  key: string,
  record?: PlutoContentBackup
) => Promise<BackupAnswer>

/** The HTTP status of an error from `$fetch` or `fetch`, when it has one. */
export function errorStatus(error: unknown): number | undefined {
  const value = error as {
    statusCode?: unknown
    status?: unknown
    response?: { status?: unknown }
  } | null
  for (const status of [
    value?.statusCode,
    value?.status,
    value?.response?.status,
  ]) {
    if (typeof status === 'number') {
      return status
    }
  }
  return undefined
}

/** A status that no retry can fix: not signed in, no right, or a record that is too large. */
const HALT_STATUSES = new Set([401, 403, 413])

/**
 * The requests of the server copy. Rules:
 * - After a GET that answers `supported: false` (the Git CMS), no more request goes out.
 * - After a 401, 403 or 413, no more request goes out (the page view stops the server copy).
 * - One write at a time. A write waits for the write in progress.
 * - A record equal to the last record sent is not sent again.
 * - A request never throws. A failed write is tried again with the next change.
 */
export function createBackupSync(options: {
  request: BackupRequest
  /** Sends a `keepalive` PUT (for `pagehide`). It must not throw. */
  sendKeepalive: (key: string, body: string) => void
}) {
  let supported: boolean | null = null
  let halted = false
  let inflight: Promise<unknown> | null = null
  let lastSent: string | null = null

  function usable(): boolean {
    return !halted && supported !== false
  }

  function signature(key: string, record: PlutoContentBackup): string {
    // The time and the tab id change without a change of the text, so they stay out.
    return JSON.stringify([
      key,
      record.version,
      record.slugTouched,
      record.changes,
    ])
  }

  function fail(error: unknown) {
    const status = errorStatus(error)
    if (status !== undefined && HALT_STATUSES.has(status)) {
      halted = true
    }
  }

  /** Runs `task` after the request in progress, as the request in progress. */
  async function exclusive<T>(task: () => Promise<T>): Promise<T> {
    if (inflight) {
      // Every waiter checks again after the wait, so the writes stay in order.
      await inflight
      return exclusive(task)
    }
    const run = task()
    const current: Promise<unknown> = run.then(
      () => undefined,
      () => undefined
    )
    inflight = current
    try {
      return await run
    } finally {
      if (inflight === current) {
        inflight = null
      }
    }
  }

  return {
    /** False after a GET answered `supported: false`. `null` before the answer. */
    get supported() {
      return supported
    },
    get halted() {
      return halted
    },
    /**
     * The answer of the server: `{ record }`, where `record` is `null` when the server has no
     * copy. `null` when there is no answer: the server keeps no copies, the page view stopped, or
     * the request failed.
     */
    async read(key: string): Promise<BackupRead> {
      if (!usable()) {
        return null
      }
      try {
        const answer = await options.request('GET', key)
        if (!answer.supported) {
          supported = false
          return null
        }
        supported = true
        return { record: answer.backup ?? null }
      } catch (error) {
        fail(error)
        return null
      }
    },
    /** Sends `record`. `otherDevice` is true when the answer says another device wrote before. */
    async write(
      key: string,
      record: PlutoContentBackup
    ): Promise<{ otherDevice: boolean }> {
      const none = { otherDevice: false }
      return exclusive(async () => {
        if (!usable()) {
          return none
        }
        const sent = signature(key, record)
        if (sent === lastSent) {
          return none
        }
        try {
          const answer = await options.request('PUT', key, record)
          if (!answer.supported) {
            supported = false
            return none
          }
          lastSent = sent
          return { otherDevice: answer.otherDevice === true }
        } catch (error) {
          fail(error)
          return none
        }
      })
    },
    /** Removes the server copy. */
    async remove(key: string): Promise<void> {
      await exclusive(async () => {
        lastSent = null
        if (!usable()) {
          return
        }
        try {
          const answer = await options.request('DELETE', key)
          if (!answer.supported) {
            supported = false
          }
        } catch (error) {
          fail(error)
        }
      })
    },
    /**
     * Sends `body` (the JSON of `record`) in a `keepalive` request, for a page that closes. It
     * does not wait for the answer.
     */
    keepalive(key: string, record: PlutoContentBackup, body: string) {
      if (!usable()) {
        return
      }
      const sent = signature(key, record)
      if (sent === lastSent) {
        return
      }
      lastSent = sent
      options.sendKeepalive(key, body)
    },
    /** Forgets the last record sent: the copy is gone (a save removed it on the server). */
    forget() {
      lastSent = null
    },
    /** Waits for the write in progress, at most `ms`. */
    async settled(ms: number): Promise<void> {
      if (!inflight) {
        return
      }
      let timer: ReturnType<typeof setTimeout> | undefined
      await Promise.race([
        inflight,
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, ms)
        }),
      ])
      clearTimeout(timer)
    },
  }
}

export type BackupSync = ReturnType<typeof createBackupSync>
