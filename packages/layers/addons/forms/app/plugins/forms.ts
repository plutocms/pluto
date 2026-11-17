import { defineAsyncComponent } from 'vue'

const PlutoFormsSubmissionsLink = defineAsyncComponent(
  () => import('../components/PlutoFormsSubmissionsLink.vue')
)

export default defineNuxtPlugin(() => {
  const git = useRuntimeConfig().public.plutoGithub as
    | { enabled?: boolean }
    | undefined
  const { can } = usePlutoPermissions()

  definePlutoExtension({
    id: 'forms',
    contentTypes:
      git?.enabled === true ? [{ id: 'form', type: plutoFormsGitType }] : [],
    nav: [
      {
        id: 'submissions',
        order: 420,
        label: 'forms.nav.submissions',
        icon: 'i-lucide-inbox',
        to: '/admin/forms',
        enabled: () => can(PLUTO_FORMS_READ_SUBMISSIONS),
      },
    ],
    settingsPages: [
      {
        id: 'forms',
        order: 170,
        label: 'forms.settings.tab',
        icon: 'i-lucide-text-cursor-input',
        to: '/admin/settings/forms',
        capability: '*',
      },
    ],
    capabilities: [
      {
        id: 'forms-write',
        key: PLUTO_FORMS_WRITE,
        label: 'forms.capabilities.write',
      },
      {
        id: 'forms-read-submissions',
        key: PLUTO_FORMS_READ_SUBMISSIONS,
        label: 'forms.capabilities.readSubmissions',
      },
    ],
    contentToolbarItems: [
      {
        id: 'submissions-link',
        contentType: 'form',
        order: 60,
        component: PlutoFormsSubmissionsLink,
      },
    ],
  })
})
