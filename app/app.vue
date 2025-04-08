<template>
  <div class="h-full">
    <UApp>
      <NuxtRouteAnnouncer />
      <NuxtLoadingIndicator />

      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </UApp>
  </div>
</template>

<script setup lang="ts">
  useHead({
    titleTemplate: '%s - Pluto Admin',
  })
</script>

<style>
  html,
  body,
  #__nuxt {
    height: 100%;
  }
</style>
