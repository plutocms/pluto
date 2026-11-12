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
  /** A wider card (32rem, not 25rem), for a longer form such as the setup of a backend. */
  wide?: boolean
}>()

const slots = defineSlots<{
  default?: () => unknown
  /** After the logo, such as an arrow and the logo of the service that the page connects to. */
  partner?: () => unknown
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
// A brand logo (white label), else the Pluto logo. The card follows the color
// mode, so it shows `logo` in light mode and `logoDark` in dark mode.
const { brand } = usePlutoBrand()
const logoLight = computed(() => brand.value.logo || brand.value.logoDark || '')
const logoDark = computed(() => brand.value.logoDark || brand.value.logo || '')
</script>

<template>
  <div class="flex min-h-dvh flex-col items-center justify-center gap-y-4 p-4">
    <UCard :class="props.wide ? 'max-w-lg' : 'max-w-100'" class="w-full">
      <div class="flex flex-col gap-y-6">
        <div class="flex items-center gap-x-2">
          <template v-if="logoLight">
            <img
              :src="logoLight"
              :alt="brand.name ?? ''"
              class="block h-8 w-auto max-w-48 object-contain dark:hidden"
            />
            <img
              :src="logoDark"
              :alt="brand.name ?? ''"
              class="hidden h-8 w-auto max-w-48 object-contain dark:block"
            />
          </template>
          <PlutoLogo
            v-else
            aria-hidden="true"
            class="text-highlighted block h-8 w-auto"
          />
          <slot name="partner" />
          <span
            v-if="siteName"
            :class="
              slots.partner
                ? 'text-muted ms-auto max-sm:hidden'
                : 'text-highlighted'
            "
            class="truncate text-sm font-semibold"
            >{{ siteName }}</span
          >
        </div>

        <template v-if="driver || slots.default">
          <div class="flex flex-col gap-y-1">
            <h1 class="text-2xl font-bold">
              {{ heading }}
            </h1>
            <p v-if="subheading" class="text-muted text-sm">
              {{ subheading }}
            </p>
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

    <!-- The admin language, before sign-in. -->
    <PlutoAdminLanguageSelect />
  </div>
</template>
