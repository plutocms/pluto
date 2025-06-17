<script setup lang="ts">
useHead({
  titleTemplate: '%s - Pluto Admin',
})
</script>

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
