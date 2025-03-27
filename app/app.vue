<template>
  <div class="h-full">
    <UApp>
      <NuxtRouteAnnouncer />
      <NuxtLoadingIndicator />

      <Navbar />

      <div class="flex h-full items-stretch">
        <div class="w-[300px] shrink-0 bg-white/5 px-4 py-8">
          <UNavigationMenu
            :items="menu"
            orientation="vertical"
            class="data-[orientation=vertical]:w-full"
          />
        </div>

        <div class="grow overflow-hidden bg-white/10">
          <NuxtPage />
        </div>
      </div>
    </UApp>
  </div>
</template>

<script setup lang="ts">
  import type { NavigationMenuItem } from '@nuxt/ui'

  const menu = ref<NavigationMenuItem[]>([
    {
      label: 'Home',
      href: '/admin',
    },
    {
      label: 'Products',
      href: '/admin/products',
    },
  ])
</script>

<style>
  html,
  body,
  #__nuxt {
    height: 100%;
  }
</style>
