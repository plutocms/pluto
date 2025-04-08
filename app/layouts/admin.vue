<template>
  <div class="bg-admin-content h-full">
    <NavbarAdmin />

    <div class="flex h-full items-stretch">
      <div class="bg-admin-sidebar w-64 shrink-0 px-4 py-8">
        <UNavigationMenu
          :items="menu"
          orientation="vertical"
          class="data-[orientation=vertical]:w-full"
        />
      </div>

      <div class="grow overflow-hidden">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { NavigationMenuItem } from '@nuxt/ui'

  const menu = ref<NavigationMenuItem[]>([
    {
      label: 'Home',
      href: '/admin/home',
    },
    {
      label: 'Products',
      href: '/admin/products',
    },
    {
      label: 'Media',
      href: '/admin/media',
    },
  ])
</script>
