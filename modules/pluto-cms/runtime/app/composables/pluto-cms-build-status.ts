import type { PlutoBuildStatus } from '../../shared/build-status'
import { onScopeDispose, shallowRef } from 'vue'
import { createBuildPoller } from '../../shared/build-poller'

export const CMS_BUILD_STATUS_URL = '/api/_pluto/cms/build-status'

/**
 * The build status of the head commit, with polling. Call it in `setup`. It does
 * not read until `check()` or `afterSave()` runs. It stops by itself when the
 * build is done, after 15 minutes, and while the page is hidden. It reads again
 * when the page is visible. The scope end stops everything.
 *
 * Each call has its own state. The admin is client-only, so nothing runs on the server.
 */
export function usePlutoCmsBuildStatus() {
  const status = shallowRef<PlutoBuildStatus | null>(null)
  const failed = shallowRef(false)
  // True after `check` or `afterSave`, until `stop`. A page that shows again reads only then.
  let started = false

  const poller = createBuildPoller({
    load: () => $fetch<PlutoBuildStatus>(CMS_BUILD_STATUS_URL),
    onStatus: (value) => {
      status.value = value
      failed.value = false
    },
    onError: () => {
      failed.value = true
    },
    isHidden: () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
  })

  function onVisibility() {
    if (document.visibilityState === 'visible' && started) {
      poller.resume()
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility)
  }
  onScopeDispose(() => {
    started = false
    poller.stop()
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility)
    }
  })

  return {
    status,
    failed,
    /** Reads now, and while the build is pending. Call it when the edit page opens. */
    check() {
      started = true
      poller.start()
    },
    /** Call it after a save. It forgets the old answer and waits for the checks of the new commit. */
    afterSave() {
      started = true
      status.value = null
      poller.start({ afterSave: true })
    },
    stop() {
      started = false
      poller.stop()
    },
  }
}
