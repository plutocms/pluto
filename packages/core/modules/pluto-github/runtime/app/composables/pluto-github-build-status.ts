import type { PlutoBuildStatus } from '../../shared/build-status'
import { onScopeDispose, shallowRef } from 'vue'
import { createBuildPoller } from '../../shared/build-poller'

export const CMS_BUILD_STATUS_URL = '/api/_pluto/github/build-status'

export function usePlutoGithubBuildStatus() {
  const status = shallowRef<PlutoBuildStatus | null>(null)
  const failed = shallowRef(false)
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
    isHidden: () =>
      typeof document !== 'undefined' && document.visibilityState === 'hidden',
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
    check() {
      started = true
      poller.start()
    },
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
