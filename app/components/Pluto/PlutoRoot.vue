<script setup lang="ts">
const { navbar } = useNavbarAdmin()
</script>

<template>
  <div class="flex min-h-0 min-w-0 w-full grow flex-col">
    <UApp class="flex min-h-0 min-w-0 w-full grow flex-col">
      <NuxtRouteAnnouncer />
      <NuxtLoadingIndicator />

      <component :is="navbar" v-if="navbar" />

      <div class="min-h-0 min-w-0 w-full grow">
        <NuxtLayout>
          <slot />
        </NuxtLayout>
      </div>
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
