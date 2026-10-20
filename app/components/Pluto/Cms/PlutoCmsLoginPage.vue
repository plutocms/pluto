<script setup lang="ts">
// The login page of the standalone CMS. The module adds it at /admin/login
// only when the CMS is on. The file lives under `app/` so Tailwind scans it.
definePageMeta({ layout: 'auth' })

const { t } = usePlutoI18n()
const route = useRoute()
const appSlug = (useRuntimeConfig().public as {
 plutoCms?: {
 appSlug?: string
}
}).plutoCms?.appSlug

useHead({ title: () => t('pluto.cms.login.title') })

const redirect = computed(() => {
  const value = route.query.redirect
  return typeof value === 'string' ? value : ''
})

// A full page load: the route is a server route that redirects to GitHub.
// The server checks the redirect again. It accepts only a path on this site.
const loginUrl = computed(() => {
  const base = '/api/_pluto/auth/github/login'
  return redirect.value ? `${base}?redirect=${encodeURIComponent(redirect.value)}` : base
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
  <div class="grid min-h-dvh place-items-center p-4">
    <UCard class="w-full max-w-100">
      <div class="flex flex-col gap-y-6">
        <div class="flex flex-col gap-y-1">
          <h1 class="text-3xl font-bold">{{ t('pluto.cms.login.title') }}</h1>
          <p class="text-muted text-sm">{{ t('pluto.cms.login.description') }}</p>
        </div>

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

        <UButton
          :label="t('pluto.cms.login.backToSite')"
          icon="lucide:arrow-left"
          to="/"
          variant="link"
          class="self-start px-0"
        />
      </div>
    </UCard>
  </div>
</template>
