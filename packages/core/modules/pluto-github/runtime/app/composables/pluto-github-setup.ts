import { computed } from 'vue'
import { useFetch, useRequestFetch } from '#imports'

export const CMS_SETUP_STATUS_URL = '/api/_pluto/github/setup/status'
/** The route that starts the GitHub App creation. Open it with a full page load. */
export const CMS_SETUP_START_URL = '/api/_pluto/github/setup/start'

export type PlutoGithubSetupCheckId =
  | 'repo'
  | 'sessionPassword'
  | 'appId'
  | 'clientId'
  | 'clientSecret'
  | 'privateKey'
  | 'installation'

/** The answer of the status route. A site that is ready says only `ready`, unless the user may see more. */
export interface PlutoGithubSetupStatus {
  ready: boolean
  repo?: string
  storage?: 'github' | 'fs'
  callbackUrl?: string
  canCreateApp?: boolean
  checks?: Array<{
    id: PlutoGithubSetupCheckId
    ok: boolean
  }>
}

/**
 * The setup status of the GitHub sign-in. The browser fetches it after
 * hydration (`server: false`). The answer has booleans and public names only.
 * `status.value` is `null` until the first answer, and after a failed read.
 */
export function usePlutoGithubSetup() {
  const asyncData = useFetch<PlutoGithubSetupStatus | null>(
    CMS_SETUP_STATUS_URL,
    {
      key: 'pluto-github-setup',
      server: false,
      $fetch: useRequestFetch(),
      default: () => null,
    }
  )

  return {
    status: computed(() => asyncData.data.value ?? null),
    pending: asyncData.pending,
    refresh: async () => {
      await asyncData.refresh()
    },
  }
}
