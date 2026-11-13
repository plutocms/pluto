import type { PlutoGithubSessionResponse } from '../composables/pluto-github-session'
import { defineAsyncComponent } from 'vue'
import { defineNuxtPlugin, useRouter, useRuntimeConfig } from '#imports'
import PlutoGithubSignIn from '../../../../../app/components/Pluto/Github/PlutoGithubSignIn.vue'
import { isAdminPath } from '../../../../../app/composables/internal/admin-shell'
import { definePlutoExtension } from '../../../../../app/composables/pluto-extension'
import { usePlutoRegistry } from '../../../../../app/composables/pluto-registry'
import { plutoGithubAuthorType } from '../../shared/author-type'
import {
  isPostTypeOn,
  showBuildStatus,
  showPublicRepoWarning,
} from '../../shared/client-rules'
import { plutoGithubPostType } from '../../shared/post-type'
import { plutoGithubTermTypes } from '../../shared/term-types'
import { usePlutoGithubLocalGit } from '../composables/pluto-github-local-git'
import {
  CMS_SESSION_URL,
  usePlutoGithubSession,
} from '../composables/pluto-github-session'

const PlutoGithubBackendDetails = defineAsyncComponent(
  () =>
    import('../../../../../app/components/Pluto/Github/PlutoGithubBackendDetails.vue')
)

const LOCAL_GIT_INTERVAL = 15_000

const PlutoGithubPublicRepoWarning = defineAsyncComponent(
  () =>
    import('../../../../../app/components/Pluto/Github/PlutoGithubPublicRepoWarning.vue')
)

export default defineNuxtPlugin(() => {
  const session = usePlutoGithubSession()
  const registry = usePlutoRegistry()

  const postType = isPostTypeOn(
    useRuntimeConfig().public.plutoGithub as
      | {
          postType?: boolean
        }
      | undefined
  )

  const buildStatus = showBuildStatus(
    useRuntimeConfig().public.plutoGithub as
      | {
          storage?: string
          skipDeploy?: boolean
        }
      | undefined
  )

  const local =
    (useRuntimeConfig().public.plutoGithub as { storage?: string } | undefined)
      ?.storage === 'fs'
  const localGit = usePlutoGithubLocalGit()
  if (local && import.meta.client) {
    watchLocalGit(localGit.refresh)
  }

  const { read, write, delete: remove } = plutoGithubPostType.capabilities ?? {}
  const capabilities = (
    postType
      ? [
          { key: read, label: 'pluto.github.capabilities.readDrafts' },
          { key: write, label: 'pluto.github.capabilities.publish' },
          { key: remove, label: 'pluto.github.capabilities.delete' },
          {
            key: plutoGithubTermTypes[0]?.capabilities?.write,
            label: 'pluto.github.capabilities.manageTerms',
          },
          {
            key: plutoGithubAuthorType.capabilities?.write,
            label: 'pluto.github.capabilities.manageAuthors',
          },
        ]
      : []
  ).flatMap((entry) =>
    entry.key
      ? [
          {
            id: entry.key.replace(':', '-'),
            key: entry.key,
            label: entry.label,
          },
        ]
      : []
  )

  definePlutoExtension({
    id: 'pluto-github',
    // The reference auth driver. The session loads in the browser only
    // (`server: false`), so `loggedIn()` is false on the server and in the first
    // client render. The navbar then appears after hydration, and a public
    // page that a CDN caches never holds a user.
    authDriver: {
      id: 'pluto-github-auth',
      user: () => {
        const user = session.user.value
        return user
          ? {
              id: String(user.id),
              name: user.name ?? undefined,
              username: user.login,
              avatarUrl: user.avatarUrl,
            }
          : null
      },
      loggedIn: () => session.loggedIn.value,
      ready: async () => {
        try {
          await session.ready()
        } catch {}
      },
      refresh: () => session.refresh(),
      signOut: () => session.logout(),
      signIn: PlutoGithubSignIn,
      signInTitle: 'pluto.github.login.title',
      signInDescription: 'pluto.github.login.description',
    },
    nav: [
      {
        id: 'users',
        order: 950,
        label: 'pluto.github.users.title',
        icon: 'i-lucide-users',
        to: '/admin/users',
      },
    ],

    backend: {
      id: 'git',
      kind: 'git',
      label: local
        ? 'pluto.github.backend.local'
        : 'pluto.github.backend.github',
      icon: local ? 'i-lucide-git-branch' : 'i-lucide-github',
      count: () => (local ? localGit.ahead.value : 0),
      countLabel: 'pluto.github.local.aheadShort',
      details: PlutoGithubBackendDetails,
      onOpen: () => {
        if (local) {
          localGit.refresh()
        }
      },
    },
    settingsPages: [
      {
        id: 'github',
        order: 150,
        label: 'pluto.settings.tabs.github',
        icon: 'pluto:github',
        to: '/admin/settings/github',
      },
      {
        id: 'deploy',
        order: 160,
        label: 'pluto.settings.tabs.deploy',
        icon: 'i-lucide-rocket',
        to: '/admin/settings/deploy',
      },
    ],
    contentTypes: postType
      ? [
          { id: 'post', type: plutoGithubPostType },
          ...plutoGithubTermTypes.map((type) => ({ id: type.name, type })),
          { id: 'author', type: plutoGithubAuthorType },
        ]
      : [],
    contentFieldWidgets: [
      {
        id: 'markdown',
        fieldType: 'richtext',
        component: defineAsyncComponent(
          () =>
            import('../../../../../app/components/Pluto/Github/PlutoFieldMarkdown.vue')
        ),
      },
    ],
    contentToolbarItems: buildStatus
      ? [
          {
            id: 'build-status',
            contentType: '*',
            order: 50,
            component: defineAsyncComponent(
              () =>
                import('../../../../../app/components/Pluto/Github/PlutoGithubBuildStatus.vue')
            ),
          },
        ]
      : [],
    capabilities,
    dashboardWidgets: [
      {
        id: 'public-repo-warning',
        order: -10,
        colSpan: 3,
        component: PlutoGithubPublicRepoWarning,
        enabled: () =>
          showPublicRepoWarning(
            session.repo.value?.private,
            registry.contentTypes.list.value.map((entry) => entry.type)
          ),
      },
    ],
    permissionsDriver: {
      id: 'pluto-github',
      load: async () => {
        const response =
          await $fetch<PlutoGithubSessionResponse>(CMS_SESSION_URL)
        return response.user ? (response.capabilities ?? []) : []
      },
    },
  })
})

let watchingLocalGit = false

function watchLocalGit(refresh: () => Promise<void>): void {
  if (watchingLocalGit) {
    return
  }
  watchingLocalGit = true
  const router = useRouter()
  const onAdmin = () => isAdminPath(router.currentRoute.value.path)
  const tick = () => {
    if (onAdmin() && document.visibilityState === 'visible') {
      refresh()
    }
  }
  router.afterEach(tick)
  document.addEventListener('visibilitychange', tick)
  setInterval(tick, LOCAL_GIT_INTERVAL)
  tick()
}
