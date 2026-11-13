<script setup lang="ts">
import { usePlutoGithubSetup } from '../../../../modules/pluto-github/runtime/app/composables/pluto-github-setup'

const props = defineProps<{
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
      trailing-icon="i-lucide-arrow-up-right"
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
