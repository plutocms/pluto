<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const menu = ref<NavigationMenuItem[]>([
  {
    label: 'Home',
    href: '/admin/home',
    icon: 'lucide:house',
  },
  {
    label: 'Products',
    href: '/admin/products',
    icon: 'lucide:box',
    onSelect: () => {
      navigateTo('/admin/products')
    },
    defaultOpen: true,
    children: [
      {
        label: 'Create new product',
        href: '/admin/product/new',
      },

      {
        label: 'All products',
        href: '/admin/products',
      },
    ],
  },
  {
    label: 'Media',
    href: '/admin/media',
    icon: 'lucide:images',
  },
  {
    label: 'Settings',
    href: '/admin/settings',
    icon: 'lucide:settings',
  },
])
</script>

<template>
  <div class="bg-admin-content light:bg-white flex h-full grow flex-col">
    <NavbarAdmin />

    <div class="flex h-full items-stretch">
      <div class="bg-admin-sidebar light:bg-zinc-200 w-64 shrink-0 px-4 py-4">
        <UNavigationMenu
          :items="menu"
          :ui="{
            link: 'text-base gap-x-3 font-normal',
          }"
          orientation="vertical"
          class="data-[orientation=vertical]:w-full"
          highlight
        />
      </div>

      <div class="grow overflow-hidden">
        <slot />
      </div>
    </div>
  </div>
</template>
