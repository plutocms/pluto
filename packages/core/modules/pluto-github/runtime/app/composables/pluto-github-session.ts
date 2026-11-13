import { computed } from 'vue'
import { useFetch, useRequestFetch, useRuntimeConfig } from '#imports'

export const CMS_SESSION_URL = '/api/_pluto/auth/session'
export const CMS_LOGOUT_URL = '/api/_pluto/auth/logout'

export interface PlutoGithubUser {
  id: number
  login: string
  name: string | null
  avatarUrl: string
}

export interface PlutoGithubSessionResponse {
  user: PlutoGithubUser | null
  capabilities?: string[]
  repo?: {
    name: string
    private?: boolean
  }
}

export function usePlutoGithubSession() {
  const isStatic =
    (useRuntimeConfig().public.plutoGithub as { static?: boolean } | undefined)
      ?.static === true
  const asyncData = useFetch<PlutoGithubSessionResponse>(CMS_SESSION_URL, {
    key: 'pluto-github-session',
    server: false,
    immediate: !isStatic,
    $fetch: useRequestFetch(),
    default: () => ({ user: null }),
  })

  const user = computed(() => asyncData.data.value?.user ?? null)
  const capabilities = computed(() => asyncData.data.value?.capabilities ?? [])
  const repo = computed(() => asyncData.data.value?.repo ?? null)

  async function ready(): Promise<void> {
    await asyncData
  }

  async function refresh(): Promise<void> {
    await asyncData.refresh()
  }

  async function logout(): Promise<void> {
    try {
      await $fetch(CMS_LOGOUT_URL, { method: 'POST' })
    } finally {
      asyncData.data.value = { user: null }
    }
  }

  return {
    user,
    capabilities,
    repo,
    loggedIn: computed(() => user.value !== null),
    status: asyncData.status,
    ready,
    refresh,
    logout,
  }
}
