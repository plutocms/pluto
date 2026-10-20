import type { PlutoCmsSessionResponse } from '../composables/pluto-cms-session'
import { defineAsyncComponent, watch } from 'vue'
import { defineNuxtPlugin } from '#imports'
import PlutoCmsNavbarProvider from '../../../../../app/components/Pluto/Cms/PlutoCmsNavbarProvider.vue'
import PlutoCmsPublicRepoWarning from '../../../../../app/components/Pluto/Cms/PlutoCmsPublicRepoWarning.vue'
import { definePlutoExtension } from '../../../../../app/composables/pluto-extension'
import { usePlutoPermissions } from '../../../../../app/composables/pluto-permissions'
import { plutoCmsPostType } from '../../shared/post-type'
import { CMS_SESSION_URL, usePlutoCmsSession } from '../composables/pluto-cms-session'

/**
 * Plugs the standalone CMS into the admin: the navbar, the permissions of the
 * signed-in user, the post type, and the post capabilities. The module adds
 * this plugin only when the CMS is on.
 */
export default defineNuxtPlugin(() => {
  // Read at setup, while the Nuxt context exists. Later callbacks have none.
  const session = usePlutoCmsSession()
  const { load, clear } = usePlutoPermissions()

  const { read, write, delete: remove } = plutoCmsPostType.capabilities ?? {}
  const capabilities = [
    { key: read, label: 'pluto.cms.capabilities.readDrafts' },
    { key: write, label: 'pluto.cms.capabilities.publish' },
    { key: remove, label: 'pluto.cms.capabilities.delete' },
  ].flatMap((entry) => (entry.key ? [{ id: entry.key.replace(':', '-'), key: entry.key, label: entry.label }] : []))

  definePlutoExtension({
    id: 'pluto-cms',
    navbar: { id: 'admin-navbar', component: PlutoCmsNavbarProvider },
    // The content type gives the Posts nav item, the list and the form.
    contentTypes: [{ id: 'post', type: plutoCmsPostType }],
    // The Markdown editor. The import is lazy, so Tiptap loads on the edit page only.
    contentFieldWidgets: [
      {
        id: 'markdown',
        fieldType: 'richtext',
        component: defineAsyncComponent(() => import('../../../../../app/components/Pluto/Cms/PlutoFieldMarkdown.vue')),
      },
    ],
    capabilities,
    dashboardWidgets: [
      {
        id: 'public-repo-warning',
        order: -10,
        colSpan: 3,
        component: PlutoCmsPublicRepoWarning,
        enabled: () => session.repo.value?.private === false,
      },
    ],
    permissionsDriver: {
      id: 'pluto-cms',
      load: async () => {
        const response = await $fetch<PlutoCmsSessionResponse>(CMS_SESSION_URL)
        return response.user ? (response.capabilities ?? []) : []
      },
    },
  })

  // Load the capabilities when the user signs in. Clear them when the user
  // signs out. This runs app-wide, so a public page knows them too.
  watch(session.loggedIn, (loggedIn) => {
    if (loggedIn) {
      load()
    } else {
      clear()
    }
  }, { immediate: true })
})
