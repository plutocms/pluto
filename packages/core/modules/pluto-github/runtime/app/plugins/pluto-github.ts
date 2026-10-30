import type { PlutoGithubSessionResponse } from '../composables/pluto-github-session'
import { defineAsyncComponent } from 'vue'
import { defineNuxtPlugin, useRuntimeConfig } from '#imports'
import PlutoGithubSignIn from '../../../../../app/components/Pluto/Github/PlutoGithubSignIn.vue'
import { definePlutoExtension } from '../../../../../app/composables/pluto-extension'
import { usePlutoRegistry } from '../../../../../app/composables/pluto-registry'
import {
  isPostTypeOn,
  showBuildStatus,
  showPublicRepoWarning,
} from '../../shared/client-rules'
import { plutoGithubPostType } from '../../shared/post-type'
import {
  CMS_SESSION_URL,
  usePlutoGithubSession,
} from '../composables/pluto-github-session'

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
    // The GitHub tab of Settings: the setup check and the Create button. The module
    // adds its route (`/admin/settings/github`) with `extendPages`.
    settingsPages: [
      {
        id: 'github',
        order: 150,
        label: 'pluto.settings.tabs.github',
        icon: 'simple-icons:github',
        to: '/admin/settings/github',
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
