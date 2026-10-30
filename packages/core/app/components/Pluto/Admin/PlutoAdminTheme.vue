<script setup lang="ts">
// The defaults of the Nuxt UI components in the admin (see
// PLUTO_ADMIN_UI_PROPS and PLUTO_ADMIN_UI). The admin layouts and the admin bar
// of the public site wrap their content in it. Overlays (modals, menus) that
// open from inside get the same defaults: UTheme uses provide/inject, which
// works across the teleport. See the admin-theme skill.
import {
  PLUTO_ADMIN_UI,
  PLUTO_ADMIN_UI_PROPS,
} from '../../../composables/pluto-admin-theme'
</script>

<template>
  <UTheme :props="PLUTO_ADMIN_UI_PROPS" :ui="PLUTO_ADMIN_UI">
    <slot />
  </UTheme>
</template>
