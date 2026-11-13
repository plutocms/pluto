<script setup lang="ts">
import {
  PLUTO_ADMIN_UI,
  PLUTO_ADMIN_UI_PROPS,
} from '../../../composables/pluto-admin-theme'
import '#build/pluto-admin.css'
</script>

<template>
  <UTheme :props="PLUTO_ADMIN_UI_PROPS" :ui="PLUTO_ADMIN_UI">
    <slot />
  </UTheme>
</template>
