<script setup lang="ts">
const websiteName = 'Pluto Admin'

useHead({
  titleTemplate: (title) => (title ? `${title} - ${websiteName}` : websiteName),
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
