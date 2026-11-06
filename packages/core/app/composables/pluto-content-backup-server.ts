import type { BackupAnswer } from './internal/content-backup-sync'
import type { PlutoBackupServer } from './pluto-content-backup'
import { createBackupSync } from './internal/content-backup-sync'

/** Time to wait for the answer of the first GET, in ms. The form also stops waiting then. */
const READ_TIMEOUT_MS = 3000

/**
 * The server copy of the content backup for one content type: the `server` slot of
 * `usePlutoContentBackup`. It talks to `/api/_pluto/content-backup/<type>`. An adapter without
 * `backups` (the Git CMS) answers `supported: false` to the first GET, and then no PUT or DELETE
 * goes out. See the content-backup skill.
 */
export function usePlutoContentBackupServer(
  typeName: () => string | undefined
): PlutoBackupServer {
  const base = useRuntimeConfig().app.baseURL

  function url(): string {
    return `/api/_pluto/content-backup/${typeName() ?? ''}`
  }

  /** The key '+new' is a new item: the route reads no `id` as a new item. */
  function query(key: string): Record<string, string> | undefined {
    return key === '+new' ? undefined : { id: key }
  }

  const sync = createBackupSync({
    request: (method, key, record) =>
      $fetch<BackupAnswer>(url(), {
        method,
        query: query(key),
        ...(record && { body: record }),
        ...(method === 'GET' && { timeout: READ_TIMEOUT_MS }),
      }),
    sendKeepalive: (key, body) => {
      const params = new URLSearchParams(query(key))
      const search = params.size > 0 ? `?${params}` : ''
      // `keepalive` lets the request finish after the page is gone. The cookies go along.
      fetch(`${base.replace(/\/$/, '')}${url()}${search}`, {
        method: 'PUT',
        keepalive: true,
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body,
      }).catch(() => {})
    },
  })

  return {
    read: (key) => sync.read(key),
    write: (key, record) => sync.write(key, record),
    remove: (key) => sync.remove(key),
    keepalive: (key, record, body) => sync.keepalive(key, record, body),
    forget: () => sync.forget(),
    settled: (ms) => sync.settled(ms),
  }
}
