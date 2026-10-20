<script setup lang="ts">
// The sign-in form of the standalone CMS: one "Sign in with GitHub" button and
// the alert for a failed sign-in. It is the `signIn` component of the CMS auth
// driver. Core renders it inside the login frame (PlutoAdminAuthCard). The file
// lives under `app/` so Tailwind scans it.
const props = defineProps<{
  /** A safe local path to open after sign-in. Core checks it. */
  redirect: string
}>()

const { t } = usePlutoI18n()
const route = useRoute()
const appSlug = (useRuntimeConfig().public as {
  plutoCms?: {
    appSlug?: string
  }
}).plutoCms?.appSlug

// A full page load: the route is a server route that redirects to GitHub.
// The server checks the redirect again. It accepts only a path on this site.
const loginUrl = computed(() => {
  const base = '/api/_pluto/auth/github/login'
  return props.redirect ? `${base}?redirect=${encodeURIComponent(props.redirect)}` : base
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

const installUrl = computed(() => (appSlug ? `https://github.com/apps/${encodeURIComponent(appSlug)}/installations/new` : ''))
</script>

<template>
  <div class="flex flex-col gap-y-6">
    <UAlert
      v-if="errorKey"
      :title="t(`pluto.cms.login.errors.${errorKey}.title`)"
      :description="t(`pluto.cms.login.errors.${errorKey}.description`)"
      color="error"
      variant="subtle"
      icon="lucide:circle-alert"
    />

    <UButton
      v-if="errorKey === 'notInstalled' && installUrl"
      :to="installUrl"
      :label="t('pluto.cms.login.installApp')"
      icon="lucide:external-link"
      target="_blank"
      color="neutral"
      variant="outline"
      class="w-full justify-center"
    />

    <UButton
      :to="loginUrl"
      :label="t('pluto.cms.login.signIn')"
      icon="simple-icons:github"
      size="lg"
      class="w-full justify-center"
      external
    />
  </div>
</template>
