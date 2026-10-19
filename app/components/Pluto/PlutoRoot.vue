<script setup lang="ts">
const { component: navbar } = usePlutoNavbarShell()

// One Nuxt UI locale per page: the admin's on /admin routes, the site's on the
// rest. The admin navbar on a public page keeps the site locale for Nuxt UI
// text, but its own labels use the admin locale through usePlutoI18n().
const route = useRoute()
const admin = usePlutoI18n()
const site = usePlutoSiteI18n()
const isAdmin = computed(() => route.path === '/admin' || route.path.startsWith('/admin/'))
const active = computed(() => (isAdmin.value ? admin : site))
const uiLocale = computed(() => active.value.uiLocale.value)

// Pluto owns <html lang> on admin routes. On public routes it sets it only
// when the app uses the site scope (it sets plutoI18n.siteLocale or
// siteLocales). Otherwise the app keeps its own app.head.htmlAttrs.
const { siteManaged } = useRuntimeConfig().public.plutoI18n
const managesLang = computed(() => isAdmin.value || Boolean(siteManaged))

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
