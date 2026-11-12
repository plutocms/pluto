<script setup lang="ts">
import SiteRoot, { siteHasApp } from '#build/pluto/site-root.mjs'

// The root of an app whose root component does not use PlutoRoot (see the pluto-root module). The
// admin and the preview of the visual editor get PlutoRoot and the page only. A public page gets
// the root of the site, which decides its layout, with a UApp of Pluto only when it has none.
const route = useRoute()
const own = computed(
  () =>
    route.path === '/admin' ||
    route.path.startsWith('/admin/') ||
    isPlutoPreviewPath(route.path)
)
</script>

<template>
  <PlutoRoot v-if="own">
    <NuxtPage />
  </PlutoRoot>

  <PlutoRoot v-else :own-app="siteHasApp" own-layout>
    <SiteRoot />
  </PlutoRoot>
</template>
