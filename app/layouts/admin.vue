<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

// `to` is typed per-app via Nuxt's typed pages, so it differs across every
// app that extends this layout as a layer. This menu only ever uses `href`,
// so drop `to` here to avoid a cross-app type mismatch on that field.
type SidebarMenuItem = Omit<NavigationMenuItem, 'to'>

function toMenuItem(item: PlutoNavItem): SidebarMenuItem {
  return {
    label: item.label,
    icon: item.icon,
    href: item.to,
    // Top-level items SPA-navigate instead of doing a full page load. This
    // matches what supabase-blog and supabase-shop's own (pre-registry)
    // sidebar entries already did — the registry now does it for every
    // item instead of only theirs. Children stay href-only, same as those
    // two layers' own child entries did.
    onSelect: item.to ? () => navigateTo(item.to) : undefined,
    defaultOpen: item.defaultOpen,
    children: item.children?.map((child) => ({
      label: child.label,
      href: child.to,
    })),
  }
}

const { items: navItems } = usePlutoAdminNav()
const menu = computed<SidebarMenuItem[]>(() => navItems.value.map(toMenuItem))

// This key is a cross-repo contract: `supabase`'s own mobile navbar
// (`app/components/navbar/NavbarAdmin.vue`) writes to this exact state key
// to open the sidebar from its own hamburger button. Keep the name as-is.
const isSidebarOpen = useState<boolean>('pluto-admin-sidebar-open', () => false)
</script>

<template>
  <UDashboardGroup
    :class="(base: string) => base.replace('inset-0', 'inset-x-0 bottom-0 top-(--ui-header-height)')"
    storage="cookie"
    storage-key="pluto-admin"
    unit="rem"
  >
    <UDashboardSidebar
      id="admin"
      v-model:open="isSidebarOpen"
      :default-size="16"
      :min-size="12"
      :max-size="24"
      :ui="{
        root: 'min-h-0 dark:bg-admin-sidebar light:bg-zinc-100',
        content: 'lg:hidden w-[min(18rem,85vw)]',
      }"
      resizable
    >
      <UNavigationMenu
        :items="menu"
        :ui="{ link: 'text-base gap-x-3 font-normal' }"
        orientation="vertical"
        class="data-[orientation=vertical]:w-full"
        highlight
      />
    </UDashboardSidebar>

    <UDashboardPanel
      :ui="{
        root: 'min-h-0 dark:bg-admin-content light:bg-white font-outfit',
        body: 'p-0 gap-0 overflow-x-hidden',
      }"
    >
      <template #body>
        <slot />
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
