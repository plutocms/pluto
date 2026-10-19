<script setup lang="ts">
// The menu items and the open state are shared with the admin menu that
// public pages show (PlutoNavbarAdminMenu). See pluto-admin-menu.ts.
const menu = usePlutoAdminMenu()
const isSidebarOpen = usePlutoAdminMenuOpen()

const commandGroups = usePlutoCommandPalette()
const { t } = usePlutoI18n()

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
    <UDashboardSearch :groups="commandGroups" :placeholder="t('pluto.palette.placeholder')" />
  </UDashboardGroup>
</template>
