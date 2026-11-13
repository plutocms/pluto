<script setup lang="ts">
import { ConfigProvider, TooltipProvider } from 'reka-ui'
import { resolveSiteName } from '../../composables/internal/admin-shell'

const props = defineProps<{
  /**
   * The slot has its own `UApp` (the root of a theme such as Docus). On a public page PlutoRoot
   * then adds only the admin bar, in the providers that it needs: a second `UApp` would show each
   * toast and overlay twice, because their state is global.
   */
  ownApp?: boolean
  /** The slot decides its layout (the root of the site): no `NuxtLayout` around it. */
  ownLayout?: boolean
}>()

const adminBar = usePlutoAdminBar()

const route = useRoute()
const admin = usePlutoI18n()
const site = usePlutoSiteI18n()
const isAdmin = computed(
  () => route.path === '/admin' || route.path.startsWith('/admin/')
)

const adminMenuOpen = usePlutoAdminMenuOpen()
watch(
  () => route.fullPath,
  () => {
    adminMenuOpen.value = false
  }
)

const active = computed(() => (isAdmin.value ? admin : site))
const uiLocale = computed(() => active.value.uiLocale.value)

const { siteManaged } = useRuntimeConfig().public.plutoI18n
const managesLang = computed(() => isAdmin.value || Boolean(siteManaged))

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

// Set the attribute on <html> in the browser, not through useHead: Unhead removes only attributes that it rendered in the browser.
if (import.meta.server) {
  useHead({
    htmlAttrs: {
      'data-pluto-admin-bar': adminBar.visible.value ? 'true' : undefined,
    },
  })
} else {
  watch(
    adminBar.visible,
    (visible) => {
      const html = document.documentElement
      if (visible) {
        html.setAttribute('data-pluto-admin-bar', 'true')
      } else {
        html.removeAttribute('data-pluto-admin-bar')
      }
    },
    { immediate: true }
  )
}

// A page that the hint changed must not go into a shared cache.
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
  <template v-if="props.ownApp && !isAdmin">
    <slot />

    <ConfigProvider :use-id="() => useId()">
      <TooltipProvider>
        <PlutoAdminNavbarProvider />
        <LazyPlutoNavbarAdminMenu v-if="adminBar.visible.value" />
      </TooltipProvider>
    </ConfigProvider>
  </template>

  <div v-else class="pluto-root">
    <UApp :locale="uiLocale">
      <NuxtRouteAnnouncer />
      <NuxtLoadingIndicator />

      <PlutoAdminNavbarProvider />

      <LazyPlutoNavbarAdminMenu v-if="!isAdmin && adminBar.visible.value" />

      <div class="pluto-root-page">
        <slot v-if="props.ownLayout" />
        <NuxtLayout v-else>
          <slot />
        </NuxtLayout>
      </div>
    </UApp>
  </div>
</template>

<style>
#__nuxt {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

:root {
  --pluto-admin-bar-height: 2.5rem;
}

:where(:root) {
  --pluto-page-height: 100dvh;
}

:where(:root[data-pluto-admin-bar]:not([data-pluto-admin])) {
  --pluto-page-height: calc(100dvh - var(--pluto-admin-bar-height));
}

:where(:root[data-pluto-admin-bar]:not([data-pluto-admin])) body {
  padding-top: var(--pluto-admin-bar-height);
}

:where(:root[data-pluto-admin-bar]:not([data-pluto-admin])) {
  scroll-padding-top: var(--pluto-admin-bar-height);
}

:root:not([data-pluto-admin]) body {
  --pluto-site-header-height: var(--ui-header-height, 4rem);
}

:root[data-pluto-admin-bar]:not([data-pluto-admin]) #__nuxt {
  --ui-header-height: calc(
    var(--pluto-site-header-height) + var(--pluto-admin-bar-height)
  );
}

:root[data-pluto-admin-bar]:not([data-pluto-admin]) .pluto-header-offset {
  top: var(--pluto-admin-bar-height);
  height: var(--pluto-site-header-height);
}

:where(:root[data-pluto-admin-bar]:not([data-pluto-admin])) #__nuxt {
  min-height: var(--pluto-page-height);
}

.pluto-root {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  width: 100%;
  min-width: 0;
  min-height: 0;
}

.pluto-root-page {
  flex-grow: 1;
  width: 100%;
  min-width: 0;
  min-height: 0;
}

:root[data-pluto-admin],
:root[data-pluto-admin] body,
:root[data-pluto-admin] #__nuxt {
  height: 100%;
}
</style>
