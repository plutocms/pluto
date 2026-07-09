<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

// `to` is typed per-app via Nuxt's typed pages, so it differs across every
// app that extends this layout as a layer. This menu only ever uses `href`,
// so drop `to` here to avoid a cross-app type mismatch on that field.
type SidebarMenuItem = Omit<NavigationMenuItem, 'to'>

const { actions: sidebarActions } = useSidebarAdminActions()

const menu = shallowRef<SidebarMenuItem[]>([
  {
    label: 'Home',
    href: '/admin/home',
    icon: 'lucide:house',
  },
  ...(sidebarActions.value as unknown as SidebarMenuItem[]),
  {
    label: 'Settings',
    href: '/admin/settings',
    icon: 'lucide:settings',
  },
])
</script>

<template>
  <div
    class="dark:bg-admin-content light:bg-white font-outfit flex h-full grow flex-col"
  >
    <NavbarAdmin />

    <div class="flex h-full items-stretch">
      <div
        class="dark:bg-admin-sidebar light:bg-zinc-100 w-64 shrink-0 px-4 py-4"
      >
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
