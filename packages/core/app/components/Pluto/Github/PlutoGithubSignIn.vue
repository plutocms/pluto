<script setup lang="ts">
// The sign-in form of the standalone CMS: one "Sign in with GitHub" button and
// the alert for a failed sign-in. It is the `signIn` component of the CMS auth
// driver. Core renders it inside the login frame (PlutoAdminAuthCard). The file
// lives under `app/` so Tailwind scans it. When the GitHub App is not set up, it also
// shows the setup check (PlutoGithubSetupPanel) and turns the button off.
import { usePlutoGithubSetup } from '../../../../modules/pluto-github/runtime/app/composables/pluto-github-setup'

const props = defineProps<{
  /** A safe local path to open after sign-in. Core checks it. */
  redirect: string
}>()

const { t } = usePlutoI18n()
const setup = usePlutoGithubSetup()
const route = useRoute()
const appSlug = (
  useRuntimeConfig().public as {
    plutoGithub?: {
      appSlug?: string
    }
  }
).plutoGithub?.appSlug

// A full page load: the route is a server route that redirects to GitHub.
// The server checks the redirect again. It accepts only a path on this site.
const loginUrl = computed(() => {
  const base = '/api/_pluto/auth/github/login'
  return props.redirect
    ? `${base}?redirect=${encodeURIComponent(props.redirect)}`
    : base
})

const errorKey = computed(() => {
  const code = route.query.error
  switch (typeof code === 'string' ? code : '') {
    case '':
      return null
    case 'forbidden':
      return 'forbidden'
    case 'not_installed':
      return 'notInstalled'
    case 'state':
      return 'state'
    default:
      return 'generic'
  }
})

// The sign-in needs the setup. The button stays off until the status says it is ready. A failed read keeps it on.
const notReady = computed(() => setup.status.value?.ready === false)

const installUrl = computed(() =>
  appSlug
    ? `https://github.com/apps/${encodeURIComponent(appSlug)}/installations/new`
    : ''
)
</script>

<template>
  <div class="flex flex-col gap-y-6">
    <UAlert
      v-if="errorKey"
      :title="t(`pluto.github.login.errors.${errorKey}.title`)"
      :description="t(`pluto.github.login.errors.${errorKey}.description`)"
      color="error"
      variant="subtle"
      icon="lucide:circle-alert"
    />

    <UButton
      v-if="errorKey === 'notInstalled' && installUrl"
      :to="installUrl"
      :label="t('pluto.github.login.installApp')"
      icon="lucide:external-link"
      target="_blank"
      color="neutral"
      variant="outline"
      class="w-full justify-center"
    />

    <PlutoGithubSetupPanel
      v-if="notReady"
      :status="setup.status.value"
      variant="login"
    />

    <UButton
      :to="notReady ? undefined : loginUrl"
      :disabled="notReady"
      :label="t('pluto.github.login.signIn')"
      icon="pluto:github"
      class="w-full justify-center"
      external
    />
  </div>
</template>
