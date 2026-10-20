<script setup lang="ts">
// The frame of the login page: the logo, the site name, the heading, the
// sign-in form of the auth driver and the links. With no driver, it shows an
// alert. See the admin-shell skill.
const props = defineProps<{
  /** A safe local path to open after sign-in. */
  redirect: string
}>()

const { t, tx } = usePlutoI18n()
const { driver } = usePlutoAuth()
const site = usePlutoSiteInfo()
const websiteName = useRuntimeConfig().public.websiteName as string | undefined

const siteName = computed(() => {
  const name = site.name.value || websiteName || ''
  return name === 'Untitled' ? '' : name
})
const title = computed(() => (driver.value?.signInTitle ? tx(driver.value.signInTitle) : t('pluto.auth.signIn')))
const description = computed(() => (driver.value?.signInDescription ? tx(driver.value.signInDescription) : ''))
const links = computed(() => driver.value?.links ?? {})
</script>

<template>
  <div class="grid min-h-dvh place-items-center p-4">
    <UCard class="w-full max-w-100">
      <div class="flex flex-col gap-y-6">
        <div class="flex items-center gap-x-2">
          <img src="/img/pluto.png" alt="" class="block h-8" />
          <span v-if="siteName" class="text-highlighted truncate text-sm font-semibold">{{ siteName }}</span>
        </div>

        <template v-if="driver">
          <div class="flex flex-col gap-y-1">
            <h1 class="text-3xl font-bold">{{ title }}</h1>
            <p v-if="description" class="text-muted text-sm">{{ description }}</p>
          </div>

          <component :is="driver.signIn" :redirect="props.redirect" />

          <div v-if="links.signUp || links.forgotPassword" class="flex flex-wrap items-center justify-between gap-2">
            <UButton v-if="links.signUp" :to="links.signUp" :label="t('pluto.auth.signUp')" variant="link" class="px-0" />
            <UButton v-if="links.forgotPassword" :to="links.forgotPassword" :label="t('pluto.auth.forgotPassword')" variant="link" class="px-0" />
          </div>
        </template>

        <UAlert
          v-else
          :title="t('pluto.auth.noMethod.title')"
          :description="t('pluto.auth.noMethod.description')"
          color="warning"
          variant="subtle"
          icon="lucide:triangle-alert"
        />

        <UButton
          :label="t('pluto.auth.backToSite')"
          icon="lucide:arrow-left"
          to="/"
          variant="link"
          class="self-start px-0"
        />
      </div>
    </UCard>
  </div>
</template>
