<template>
  <div class="grow">
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
  body {
    height: 100%;
  }

  #__nuxt {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
</style>
