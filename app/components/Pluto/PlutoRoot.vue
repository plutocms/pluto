<script setup lang="ts">
import { resolveSiteName } from '../../composables/internal/admin-shell'

// A legacy shell is a navbar a backend layer registers itself (the registry
// `navbar` field, or `useNavbarAdmin()` from utils). It wins over the core bar
// until that layer migrates to the auth driver. Remove it with the legacy bridge.
const { component: navbar } = usePlutoNavbarShell()
const adminBar = usePlutoAdminBar()

// One Nuxt UI locale per page: the admin's on /admin routes, the site's on the
// rest. The admin navbar on a public page keeps the site locale for Nuxt UI
// text, but its own labels use the admin locale through usePlutoI18n().
const route = useRoute()
const admin = usePlutoI18n()
const site = usePlutoSiteI18n()
const isAdmin = computed(() => route.path === '/admin' || route.path.startsWith('/admin/'))

// Close the admin menu after a navigation, so it is not open on the next
// page. The watch lives here because the public-page menu unmounts when the
// route moves into /admin, before its own watch could run.
const adminMenuOpen = usePlutoAdminMenuOpen()
watch(() => route.fullPath, () => {
  adminMenuOpen.value = false
})

if (import.meta.dev) {
  // A flag, not `stop()`: with `immediate`, the first call runs before
  // `watch` returns its stop handle.
  let warned = false
  watch(navbar, (legacy) => {
    if (legacy && !warned) {
      warned = true
      console.warn('[pluto] A layer registers its own admin navbar. This is deprecated. Register an authDriver and let core render the navbar.')
    }
  }, { immediate: true })
}
const active = computed(() => (isAdmin.value ? admin : site))
const uiLocale = computed(() => active.value.uiLocale.value)

// Pluto owns <html lang> on admin routes. On public routes it sets it only
// when the app uses the site scope (it sets plutoI18n.siteLocale or
// siteLocales). Otherwise the app keeps its own app.head.htmlAttrs.
const { siteManaged } = useRuntimeConfig().public.plutoI18n
const managesLang = computed(() => isAdmin.value || Boolean(siteManaged))

// The tab title of an admin route is "Page - Site name". The site name is the
// site info name, then the `websiteName` runtime config, then the admin name.
// Public routes keep the title template of the app. Every value is the same on
// the server and on the client, so the title is hydration-safe.
const siteInfo = usePlutoSiteInfo()
const websiteName = useRuntimeConfig().public.websiteName as string | undefined
const siteName = computed(() => resolveSiteName(siteInfo.name.value, websiteName, admin.t('pluto.app.name')))

// The input is reactive, so a public route adds no entry and the title
// template of the app stays in force there.
useHead(
  computed(() => (isAdmin.value
    ? { titleTemplate: (title?: string) => (title ? `${title} - ${siteName.value}` : siteName.value) }
    : {}))
)

useHead({
  htmlAttrs: {
    lang: computed(() => (managesLang.value ? active.value.locale.value : undefined)),
    dir: computed(() => (managesLang.value ? (uiLocale.value?.dir ?? 'ltr') : undefined)),
  },
})
</script>

<template>
  <div class="flex min-h-0 min-w-0 w-full grow flex-col">
    <UApp :locale="uiLocale" class="flex min-h-0 min-w-0 w-full grow flex-col">
      <NuxtRouteAnnouncer />
      <NuxtLoadingIndicator />

      <component :is="navbar" v-if="navbar" />
      <PlutoAdminNavbarProvider v-else />

      <!--
        Public pages have no admin sidebar. The admin navbar menu button
        opens this slideover there instead.
      -->
      <PlutoNavbarAdminMenu v-if="!isAdmin && (navbar || adminBar.visible.value)" />

      <div class="min-h-0 min-w-0 w-full grow">
        <NuxtLayout>
          <slot />
        </NuxtLayout>
      </div>
    </UApp>
  </div>
</template>

<style>
html,
body {
  height: 100%;
}

#__nuxt {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>
