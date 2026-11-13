import type { LocalGitStatus } from '../../server/store/local-git'
import { computed } from 'vue'
import { useState } from '#imports'

export type { LocalGitStatus }

export const CMS_LOCAL_STATUS_URL = '/api/_pluto/github/local/status'
export const CMS_LOCAL_PUSH_URL = '/api/_pluto/github/local/push'

export function usePlutoGithubLocalGit() {
  const status = useState<LocalGitStatus | null>(
    'pluto-github-local-git',
    () => null
  )
  const pushing = useState('pluto-github-local-git-pushing', () => false)

  async function refresh(): Promise<void> {
    try {
      status.value = await $fetch<LocalGitStatus>(CMS_LOCAL_STATUS_URL)
    } catch {
      status.value = null
    }
  }

  async function push(): Promise<void> {
    pushing.value = true
    try {
      status.value = await $fetch<LocalGitStatus>(CMS_LOCAL_PUSH_URL, {
        method: 'POST',
      })
    } finally {
      pushing.value = false
    }
  }

  return {
    status,
    pushing,
    ahead: computed(() => (status.value?.repo ? status.value.ahead : 0)),
    refresh,
    push,
  }
}
