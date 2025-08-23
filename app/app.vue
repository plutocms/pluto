<script setup lang="ts">
const websiteName = 'Pluto Admin'

useHead({
  titleTemplate: (title) => (title ? `${title} - ${websiteName}` : websiteName),
})
</script>

<template>
  <PlutoRoot>
    <NuxtPage />
  </PlutoRoot>
</template>
