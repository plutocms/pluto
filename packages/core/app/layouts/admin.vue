<script setup lang="ts">
// The menu items and the open state are shared with the admin menu that
// public pages show (PlutoNavbarAdminMenu). See pluto-admin-menu.ts.
const menu = usePlutoAdminMenu()
const openGroups = usePlutoAdminMenuGroups()
const isSidebarOpen = usePlutoAdminMenuOpen()

const commandGroups = usePlutoCommandPalette()
const { t } = usePlutoI18n()

// Banners from the layers (adminBanners), sorted by order. They show above the page.
const banners = usePlutoRegistry().adminBanners.list

// Keep the consumer app's public-site theme out of the admin.
usePlutoAdminTheme()

// Start the dashboard group below the fixed admin navbar. An inline `top`
// overrides the `top: 0` from the group's `inset-0` base class, whatever
// order the classes merge in. Do not use a class replacer function here:
// in @nuxt/ui 4.12 a replacer only runs for themes with slots, and the
// group theme has only `base`, so the replacer was silently ignored.
const groupStyle = { top: 'var(--pluto-admin-bar-height)' }
</script>

<template>
  <PlutoAdminTheme>
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
          footer: 'max-lg:hidden',
        }"
        :collapsed-size="4"
        resizable
        collapsible
      >
        <!--
          The search button must sit inside UDashboardGroup. Outside it, the
          button has no dashboard context and its click does nothing.
        -->
        <template #header="{ collapsed }">
          <UDashboardSearchButton
            :collapsed="collapsed"
            :class="collapsed ? undefined : 'w-full'"
            variant="soft"
          />
        </template>

        <!--
          Collapsed (desktop only), the sidebar is a rail of icons: a tooltip names each item, and a
          popover lists the children of a group. Nuxt UI keeps the state in the group cookie.
        -->
        <template #default="{ collapsed }">
          <PlutoAdminNavMenu
            v-model="openGroups"
            :items="menu"
            :collapsed="collapsed"
            :ui="{ link: 'gap-x-2.5 py-2', linkLeadingIcon: 'size-4.5' }"
            orientation="vertical"
            variant="pill"
            class="data-[orientation=vertical]:w-full"
            tooltip
            popover
          />
        </template>

        <template #footer>
          <UDashboardSidebarCollapse color="neutral" variant="ghost" />
        </template>
      </UDashboardSidebar>

      <UDashboardPanel
        :ui="{
          root: 'min-h-0 bg-(--pluto-admin-canvas)',
          // The pages set their own padding. Nuxt UI also adds `sm:p-6` and
          // `sm:gap-6`, and the merge keeps a responsive class, so reset them too.
          // `scrollbar-gutter: stable` keeps the scrollbar space on a short page,
          // so the content does not move sideways between pages. A page with
          // PlutoViewAdminPanel (`data-pluto-view`) scrolls in its own region,
          // which keeps the gutter itself.
          body: 'p-0 sm:p-0 gap-0 sm:gap-0 overflow-x-hidden scrollbar-gutter-stable has-data-pluto-view:scrollbar-gutter-auto',
        }"
      >
        <template #body>
          <!-- An empty fallback: a banner never blocks the layout. -->
          <Suspense v-for="banner in banners" :key="banner.id">
            <component :is="banner.component" />

            <template #fallback />
          </Suspense>
          <slot />
        </template>
      </UDashboardPanel>

      <!-- Cmd/Ctrl+K. See usePlutoCommandPalette for the commands. -->
      <!-- `pluto-admin-search` gets the darker, blurred overlay (pluto-layer.css). -->
      <UDashboardSearch
        :groups="commandGroups"
        :placeholder="t('pluto.palette.placeholder')"
        :ui="{ modal: 'pluto-admin-search' }"
      />
    </UDashboardGroup>
  </PlutoAdminTheme>
</template>
