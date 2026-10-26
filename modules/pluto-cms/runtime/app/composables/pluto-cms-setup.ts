import { computed } from 'vue'
import { useFetch, useRequestFetch } from '#imports'

export const CMS_SETUP_STATUS_URL = '/api/_pluto/cms/setup/status'
/** The route that starts the GitHub App creation. Open it with a full page load. */
export const CMS_SETUP_START_URL = '/api/_pluto/cms/setup/github/start'

export type PlutoCmsSetupCheckId = 'repo' | 'sessionPassword' | 'appId' | 'clientId' | 'clientSecret' | 'privateKey' | 'installation'

/** The answer of the status route. A site that is ready says only `ready`, unless the user may see more. */
export interface PlutoCmsSetupStatus {
  ready: boolean
  repo?: string
  storage?: 'github' | 'fs'
  callbackUrl?: string
  canCreateApp?: boolean
  checks?: Array<{
 id: PlutoCmsSetupCheckId
ok: boolean
}>
}

/**
 * The setup status of the GitHub sign-in. The browser fetches it after
 * hydration (`server: false`). The answer has booleans and public names only.
 * `status.value` is `null` until the first answer, and after a failed read.
 */
export function usePlutoCmsSetup() {
  const asyncData = useFetch<PlutoCmsSetupStatus | null>(CMS_SETUP_STATUS_URL, {
    key: 'pluto-cms-setup',
    server: false,
    $fetch: useRequestFetch(),
    default: () => null,
  })

  return {
    status: computed(() => asyncData.data.value ?? null),
    pending: asyncData.pending,
    refresh: async () => {
      await asyncData.refresh()
    },
  }
}
