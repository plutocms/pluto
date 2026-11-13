<script setup lang="ts">
import SiteRoot, { siteHasApp } from '#build/pluto/site-root.mjs'

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
