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

const commandGroups = usePlutoCommandPalette()

// Keep the consumer app's public-site theme out of the admin.
usePlutoAdminTheme()

// Start the dashboard group below the fixed admin navbar. An inline `top`
// overrides the `top: 0` from the group's `inset-0` base class, whatever
// order the classes merge in. Do not use a class replacer function here:
// in @nuxt/ui 4.12 a replacer only runs for themes with slots, and the
// group theme has only `base`, so the replacer was silently ignored.
const groupStyle = { top: 'var(--ui-header-height)' }
</script>

<template>
  <UDashboardGroup
    :style="groupStyle"
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
        root: 'min-h-0 bg-(--pluto-admin-sidebar)',
        content: 'lg:hidden w-[min(18rem,85vw)] bg-(--pluto-admin-sidebar)',
        header: 'h-auto py-3',
      }"
      resizable
    >
      <!--
        The search button must sit inside UDashboardGroup. Outside it, the
        button has no dashboard context and its click does nothing.
      -->
      <template #header>
        <UDashboardSearchButton class="w-full" />
      </template>

      <UNavigationMenu
        :items="menu"
        :ui="{ link: 'gap-x-2.5 py-2', linkLeadingIcon: 'size-[18px]' }"
        orientation="vertical"
        variant="pill"
        class="data-[orientation=vertical]:w-full"
      />
    </UDashboardSidebar>

    <UDashboardPanel
      :ui="{
        root: 'min-h-0 bg-(--pluto-admin-canvas)',
        body: 'p-0 gap-0 overflow-x-hidden',
      }"
    >
      <template #body>
        <slot />
      </template>
    </UDashboardPanel>

    <!-- Cmd/Ctrl+K. See usePlutoCommandPalette for the commands. -->
    <UDashboardSearch :groups="commandGroups" placeholder="Search pages and actions…" />
  </UDashboardGroup>
</template>
