import { computed } from 'vue'
import { useFetch, useRequestFetch } from '#imports'

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

/**
 * The signed-in CMS user. The state is shared across the app under one key.
 *
 * The browser fetches it after hydration (`server: false`). The server never
 * reads it, so a public page that a CDN caches never holds a user. The admin
 * is client-only, so it loses nothing. The response has no token.
 */
export function usePlutoGithubSession() {
  const asyncData = useFetch<PlutoGithubSessionResponse>(CMS_SESSION_URL, {
    key: 'pluto-github-session',
    server: false,
    $fetch: useRequestFetch(),
    default: () => ({ user: null }),
  })

  const user = computed(() => asyncData.data.value?.user ?? null)
  const capabilities = computed(() => asyncData.data.value?.capabilities ?? [])
  const repo = computed(() => asyncData.data.value?.repo ?? null)

  /** Waits for the first answer. A route middleware uses it. */
  async function ready(): Promise<void> {
    await asyncData
  }

  async function refresh(): Promise<void> {
    await asyncData.refresh()
  }

  /** Ends the session on the server, then clears it here. The caller picks the next page. */
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
