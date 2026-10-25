<script setup lang="ts">
// The frame of the admin auth pages: the logo, the site name, the heading,
// the body and "Back to the site". With no default slot, the body is the
// sign-in form of the auth driver and its links. With no driver, it shows an
// alert. A backend uses the slot for its other auth pages (sign up, password
// reset), so every auth page has the same frame. See the admin-shell skill.
const props = defineProps<{
  /** A safe local path to open after sign-in. */
  redirect?: string
  /** Key-or-literal. Replaces the driver's sign-in title. */
  title?: string
  /** Key-or-literal. Replaces the driver's sign-in description. */
  description?: string
}>()

const slots = defineSlots<{
  default?: () => unknown
}>()

const { t, tx } = usePlutoI18n()
const { driver } = usePlutoAuth()
const site = usePlutoSiteInfo()
const websiteName = useRuntimeConfig().public.websiteName as string | undefined

const siteName = computed(() => {
  const name = site.name.value || websiteName || ''
  return name === 'Untitled' ? '' : name
})
const heading = computed(() => {
  const value =
    props.title ?? (slots.default ? undefined : driver.value?.signInTitle)
  return value ? tx(value) : t('pluto.auth.signIn')
})
const subheading = computed(() => {
  const value =
    props.description ??
    (slots.default ? undefined : driver.value?.signInDescription)
  return value ? tx(value) : ''
})
const links = computed(() => driver.value?.links ?? {})
</script>

<template>
  <div class="grid min-h-dvh place-items-center p-4">
    <UCard class="w-full max-w-100">
      <div class="flex flex-col gap-y-6">
        <div class="flex items-center gap-x-2">
          <PlutoLogo
            aria-hidden="true"
            class="text-highlighted block h-8 w-auto"
          />
          <span
            v-if="siteName"
            class="text-highlighted truncate text-sm font-semibold"
            >{{ siteName }}</span
          >
        </div>

        <template v-if="driver || slots.default">
          <div class="flex flex-col gap-y-1">
            <h1 class="text-3xl font-bold">{{ heading }}</h1>
            <p v-if="subheading" class="text-muted text-sm">{{ subheading }}</p>
          </div>

          <slot v-if="slots.default" />

          <template v-else-if="driver">
            <component :is="driver.signIn" :redirect="props.redirect ?? ''" />

            <div
              v-if="links.signUp || links.forgotPassword"
              class="flex flex-wrap items-center justify-between gap-2"
            >
              <UButton
                v-if="links.signUp"
                :to="links.signUp"
                :label="t('pluto.auth.signUp')"
                variant="link"
                class="px-0"
              />
              <UButton
                v-if="links.forgotPassword"
                :to="links.forgotPassword"
                :label="t('pluto.auth.forgotPassword')"
                variant="link"
                class="px-0"
              />
            </div>
          </template>
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
