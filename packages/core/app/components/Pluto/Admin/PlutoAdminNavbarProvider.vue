<script setup lang="ts">
// Decides if the core admin navbar shows. The rule lives in `usePlutoAdminBar`.
// The navbar is lazy, so its code and the admin CSS load only when it shows.
const { visible } = usePlutoAdminBar()
</script>

<template>
  <LazyPlutoAdminNavbar v-if="visible" />
</template>
