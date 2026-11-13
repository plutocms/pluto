<script setup lang="ts">
const { visible } = usePlutoAdminBar()
</script>

<template>
  <LazyPlutoAdminNavbar v-if="visible" />
</template>
