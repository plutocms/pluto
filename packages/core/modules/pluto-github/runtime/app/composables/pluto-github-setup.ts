import { computed } from 'vue'
import { useFetch, useRequestFetch } from '#imports'

export const CMS_SETUP_STATUS_URL = '/api/_pluto/github/setup/status'
export const CMS_SETUP_START_URL = '/api/_pluto/github/setup/start'

export type PlutoGithubSetupCheckId =
  | 'repo'
  | 'sessionPassword'
  | 'appId'
  | 'clientId'
  | 'clientSecret'
  | 'privateKey'
  | 'installation'

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
