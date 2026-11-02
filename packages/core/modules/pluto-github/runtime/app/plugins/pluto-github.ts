import type { PlutoGithubSessionResponse } from '../composables/pluto-github-session'
import { defineAsyncComponent } from 'vue'
import { defineNuxtPlugin, useRouter, useRuntimeConfig } from '#imports'
import PlutoGithubSignIn from '../../../../../app/components/Pluto/Github/PlutoGithubSignIn.vue'
import { isAdminPath } from '../../../../../app/composables/internal/admin-shell'
import { definePlutoExtension } from '../../../../../app/composables/pluto-extension'
import { usePlutoRegistry } from '../../../../../app/composables/pluto-registry'
import {
  isPostTypeOn,
  showBuildStatus,
  showPublicRepoWarning,
} from '../../shared/client-rules'
import { plutoGithubPostType } from '../../shared/post-type'
import { usePlutoGithubLocalGit } from '../composables/pluto-github-local-git'
import {
  CMS_SESSION_URL,
  usePlutoGithubSession,
} from '../composables/pluto-github-session'

// The popover of the backend badge. It loads when the popover opens.
const PlutoGithubBackendDetails = defineAsyncComponent(
  () =>
    import('../../../../../app/components/Pluto/Github/PlutoGithubBackendDetails.vue')
)

/** How often the badge reads the local repo again while an admin page shows. */
const LOCAL_GIT_INTERVAL = 15_000

// The dashboard loads each widget on demand, with a skeleton.
const PlutoGithubPublicRepoWarning = defineAsyncComponent(
  () =>
    import('../../../../../app/components/Pluto/Github/PlutoGithubPublicRepoWarning.vue')
)

/**
 * Plugs the standalone CMS into the admin: the auth driver (core renders the
 * navbar, the login page and the route guard from it), the permissions of the
 * signed-in user, the post type, and the post capabilities. The module adds
 * this plugin only when the CMS is on.
 */
export default defineNuxtPlugin(() => {
  // Read at setup, while the Nuxt context exists. Later callbacks have none.
  const session = usePlutoGithubSession()
  const registry = usePlutoRegistry()

  // The server registers the post type only when `postType` is on. The client follows it.
  const postType = isPostTypeOn(
    useRuntimeConfig().public.plutoGithub as
      | {
          postType?: boolean
        }
      | undefined
  )

  // The build status shows when a save starts a deploy, and the content is in GitHub.
  const buildStatus = showBuildStatus(
    useRuntimeConfig().public.plutoGithub as
      | {
          storage?: string
          skipDeploy?: boolean
        }
      | undefined
  )

  // Local mode: the saves are commits in the local repo. The badge counts the commits that are
  // not pushed. The status route exists in this mode only.
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
        } catch {
          // A failed session read counts as signed out.
        }
      },
      refresh: () => session.refresh(),
      signOut: () => session.logout(),
      signIn: PlutoGithubSignIn,
      signInTitle: 'pluto.github.login.title',
      signInDescription: 'pluto.github.login.description',
    },
    // The Users item of the menu, between Media (900) and Settings (1000). The page
    // (`/admin/users`, added by the module) lists the people with write access to the repo.
    nav: [
      {
        id: 'users',
        order: 950,
        label: 'pluto.github.users.title',
        icon: 'i-lucide-users',
        to: '/admin/users',
      },
    ],

    // The backend badge of the navbar: local files with Git, or a GitHub repo.
    backend: {
      id: 'git',
      kind: 'git',
      label: local
        ? 'pluto.github.backend.local'
        : 'pluto.github.backend.github',
      icon: local ? 'i-lucide-hard-drive' : 'i-pluto-github',
      count: () => (local ? localGit.ahead.value : 0),
      countLabel: 'pluto.github.local.aheadShort',
      details: PlutoGithubBackendDetails,
      onOpen: () => {
        if (local) {
          localGit.refresh()
        }
      },
    },
    // The GitHub tab of Settings: the setup check and the Create button. The module
    // adds its route (`/admin/settings/github`) with `extendPages`.
    settingsPages: [
      {
        id: 'github',
        order: 150,
        label: 'pluto.settings.tabs.github',
        icon: 'pluto:github',
        to: '/admin/settings/github',
      },
      // The Deploy tab: put the site on a host. The module adds its route too.
      {
        id: 'deploy',
        order: 160,
        label: 'pluto.settings.tabs.deploy',
        icon: 'i-lucide-rocket',
        to: '/admin/settings/deploy',
      },
    ],
    // The content type gives the Posts nav item, the list and the form.
    contentTypes: postType ? [{ id: 'post', type: plutoGithubPostType }] : [],
    // The Markdown editor. The import is lazy, so Tiptap loads on the edit page only.
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
    // The build of the head commit, next to Save. Lazy, like the editor.
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
    // Core loads the capabilities after sign-in and clears them after sign-out.
    // See app/plugins/pluto-auth-sync.client.ts.
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

/**
 * Reads the local repo on each admin navigation, when the tab shows again, and every
 * `LOCAL_GIT_INTERVAL` while an admin page shows. A save commits on the server, so the count
 * follows within that time, or at once on the next navigation.
 */
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
