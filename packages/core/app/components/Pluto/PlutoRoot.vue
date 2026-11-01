<script setup lang="ts">
import { resolveSiteName } from '../../composables/internal/admin-shell'

const adminBar = usePlutoAdminBar()

// One Nuxt UI locale per page: the admin's on /admin routes, the site's on the
// rest. The admin navbar on a public page keeps the site locale for Nuxt UI
// text, but its own labels use the admin locale through usePlutoI18n().
const route = useRoute()
const admin = usePlutoI18n()
const site = usePlutoSiteI18n()
const isAdmin = computed(
  () => route.path === '/admin' || route.path.startsWith('/admin/')
)

// Close the admin menu after a navigation, so it is not open on the next
// page. The watch lives here because the public-page menu unmounts when the
// route moves into /admin, before its own watch could run.
const adminMenuOpen = usePlutoAdminMenuOpen()
watch(
  () => route.fullPath,
  () => {
    adminMenuOpen.value = false
  }
)

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
// The brand of the admin (white label): the primary scale, the radius and the
// fonts, after the admin theme. See usePlutoBrand and the admin-theme skill.
const plutoBrand = usePlutoBrand()
useHead({
  style: computed(() =>
    plutoBrand.css.value
      ? [{ key: 'pluto-brand', textContent: plutoBrand.css.value }]
      : []
  ),
})

if (import.meta.dev) {
  const primary = plutoBrand.brand.value.primary
  if (primary !== undefined && !isPlutoBrandHex(primary)) {
    console.warn(
      `[pluto] appConfig.pluto.brand.primary must be a hex color such as #0F766E. "${primary}" is not used.`
    )
  } else if (primary && plutoBrandContrast(primary) < 4.5) {
    console.warn(
      `[pluto] appConfig.pluto.brand.primary ${primary} has ${plutoBrandContrast(primary).toFixed(1)}:1 contrast with white text. Use a darker color (4.5:1 or more).`
    )
  }
}

const siteInfo = usePlutoSiteInfo()
const websiteName = useRuntimeConfig().public.websiteName as string | undefined
const siteName = computed(() =>
  resolveSiteName(
    siteInfo.name.value,
    websiteName,
    plutoBrand.brand.value.name || admin.t('pluto.app.name')
  )
)

// The input is reactive, so a public route adds no entry and the title
// template of the app stays in force there.
useHead(
  computed(() =>
    isAdmin.value
      ? {
          titleTemplate: (title?: string) =>
            title ? `${title} - ${siteName.value}` : siteName.value,
        }
      : {}
  )
)

// `data-pluto-admin-bar` marks <html> while the admin bar shows, so a site can
// offset its own header only then. It follows the bar, so it is in the server
// HTML when the hint puts the bar there (see `usePlutoAdminBar`).
useHead({
  htmlAttrs: {
    'data-pluto-admin-bar': computed(() =>
      adminBar.visible.value ? 'true' : undefined
    ),
  },
})

// A page that the hint changed must not go into a shared cache. The bar holds
// no user data, but a cached copy would show its empty frame to every visitor.
if (import.meta.server && usePlutoAdminBarHint().value) {
  useResponseHeader('Cache-Control').value = 'private, no-store'
}

useHead({
  htmlAttrs: {
    lang: computed(() =>
      managesLang.value ? active.value.locale.value : undefined
    ),
    dir: computed(() =>
      managesLang.value ? (uiLocale.value?.dir ?? 'ltr') : undefined
    ),
  },
})
</script>

<template>
  <div class="flex min-h-0 w-full min-w-0 grow flex-col">
    <UApp :locale="uiLocale" class="flex min-h-0 w-full min-w-0 grow flex-col">
      <NuxtRouteAnnouncer />
      <NuxtLoadingIndicator />

      <PlutoAdminNavbarProvider />

      <!--
        Public pages have no admin sidebar. The admin navbar menu button
        opens this slideover there instead.
      -->
      <LazyPlutoNavbarAdminMenu v-if="!isAdmin && adminBar.visible.value" />

      <div class="min-h-0 w-full min-w-0 grow">
        <NuxtLayout>
          <slot />
        </NuxtLayout>
      </div>
    </UApp>
  </div>
</template>

<style>
/*
 * The page is at least one viewport tall and grows with its content. A fixed
 * `height: 100%` would cap every wrapper at one viewport, and a sticky header
 * (a Nuxt UI `UHeader`) would leave after one viewport of scroll, because a
 * sticky element stays inside its parent. The admin keeps the fixed height.
 */
#__nuxt {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

:root[data-pluto-admin],
:root[data-pluto-admin] body,
:root[data-pluto-admin] #__nuxt {
  height: 100%;
}
</style>
