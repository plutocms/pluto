<script setup lang="ts">
import SiteRoot from '#build/pluto-docs/site-root.mjs'

// The root of an app whose own root does not use PlutoRoot (a theme such as Docus, see the module).
// The admin and the preview of the visual editor get PlutoRoot and the page only: no header,
// footer or search of the site. A public page gets the root of the site, and the admin bar for
// staff (`PlutoRoot` with `bare`: the site root has its own UApp and layout).
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

  <PlutoRoot v-else bare>
    <SiteRoot />
  </PlutoRoot>
</template>

<style>
/*
 * The header of the site under the admin bar, with no CSS entry of the site (the rules of
 * pluto-layer.css, in plain CSS; see the admin-bar-offset skill). The app config of the layer
 * gives every UHeader the class `pluto-header-offset`.
 */
:root:not([data-pluto-admin]) {
  --pluto-site-header-height: 4rem;
}

:root[data-pluto-admin-bar]:not([data-pluto-admin]) {
  --ui-header-height: calc(
    var(--pluto-site-header-height) + var(--pluto-admin-bar-height)
  );
}

:root[data-pluto-admin-bar]:not([data-pluto-admin]) .pluto-header-offset {
  top: var(--pluto-admin-bar-height);
  height: var(--pluto-site-header-height);
}
</style>
