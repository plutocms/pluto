<script setup lang="ts"></script>

<template>
  <div class="grow">
    <UApp>
      <NuxtRouteAnnouncer />
      <NuxtLoadingIndicator />

      <NuxtLayout>
        <slot />
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
