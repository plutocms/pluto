// No Nuxt auto-imports here: plain Vitest imports this file.
import type { PlutoContentBackup } from '../../../shared/utils/content-backup'

export interface BackupAnswer {
  supported: boolean
  backup?: PlutoContentBackup | null
  otherDevice?: boolean
}

export type BackupRead = { record: PlutoContentBackup | null } | null

export type BackupRequest = (
  method: 'GET' | 'PUT' | 'DELETE',
  key: string,
  record?: PlutoContentBackup
) => Promise<BackupAnswer>

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

const HALT_STATUSES = new Set([401, 403, 413])

export function createBackupSync(options: {
  request: BackupRequest
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

  async function exclusive<T>(task: () => Promise<T>): Promise<T> {
    if (inflight) {
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
    get supported() {
      return supported
    },
    get halted() {
      return halted
    },
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
    forget() {
      lastSent = null
    },
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
