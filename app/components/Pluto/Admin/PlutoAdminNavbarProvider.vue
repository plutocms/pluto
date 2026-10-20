<script setup lang="ts">
// Decides if the core admin navbar shows. The rule lives in `usePlutoAdminBar`.
const { visible } = usePlutoAdminBar()
</script>

<template>
  <PlutoAdminNavbar v-if="visible" />
</template>
