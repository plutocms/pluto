<script setup lang="ts">
// The menu items and the open state are shared with the admin menu that
// public pages show (PlutoNavbarAdminMenu). See pluto-admin-menu.ts.
const menu = usePlutoAdminMenu()
const openGroups = usePlutoAdminMenuGroups()
const isSidebarOpen = usePlutoAdminMenuOpen()
// The navigation menu is a slideover on a narrow screen: Back (or the back swipe) closes it.
usePlutoBackClose(isSidebarOpen, useMediaQuery('(max-width: 63.99rem)'))

const commandGroups = usePlutoCommandPalette()
const { t } = usePlutoI18n()
const colorMode = useColorMode()

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
    <!-- The group has the color of the bar and the sidebar, with no border between them: it shows
         at the rounded top left corner of the page (`lg:rounded-ss-xl` on the panel). -->
    <UDashboardGroup
      :style="groupStyle"
      class="bg-(--pluto-admin-navbar)"
      storage="cookie"
      storage-key="pluto-admin"
      unit="rem"
    >
      <!-- The sidebar is dark in both modes, like the navbar: `data-pluto-admin-dark` gives its text
           and buttons the dark tokens. The slideover of a narrow screen gets them from the slot
           wrappers. -->
      <UDashboardSidebar
        id="admin"
        v-model:open="isSidebarOpen"
        :default-size="16"
        :min-size="12"
        :max-size="24"
        :ui="{
          root: 'min-h-0 border-e-0 bg-(--pluto-admin-navbar)',
          content: 'lg:hidden w-[min(18rem,85vw)] bg-(--pluto-admin-navbar)',
          header: 'h-auto py-3',
          // The body does not scroll: PlutoAdminSidebarScroll does, with its own padding.
          body: 'gap-0 overflow-hidden p-0 sm:px-0',
          // A line above the footer, open sidebar only. Collapsed, the line is transparent, not
          // gone: the footer keeps its height, so its buttons stay put.
          footer:
            'border-default max-lg:hidden border-t in-data-[collapsed=true]:border-transparent',
        }"
        :collapsed-size="4.5"
        data-pluto-admin-dark
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
            :class="collapsed ? 'px-2.5' : 'w-full'"
            variant="soft"
          />
        </template>

        <!--
          Collapsed (desktop only), the sidebar is a rail of icons: a tooltip names each item, and a
          popover lists the children of a group. Nuxt UI keeps the state in the group cookie.
        -->
        <template #default="{ collapsed }">
          <PlutoAdminSidebarScroll>
            <PlutoAdminNavMenu
              v-model="openGroups"
              :items="menu"
              :collapsed="collapsed"
              orientation="vertical"
              variant="pill"
              class="data-[orientation=vertical]:w-full"
              tooltip
              popover
            />
          </PlutoAdminSidebarScroll>
        </template>

        <!-- The collapse button, and a light/dark button (the user menu has the full theme
             choice). In the rail the light/dark button goes above, so the collapse button stays put. -->
        <template #footer="{ collapsed }">
          <div
            :class="[
              'flex gap-1.5',
              collapsed ? 'flex-col-reverse items-start' : 'items-center',
            ]"
          >
            <UDashboardSidebarCollapse
              color="neutral"
              variant="ghost"
              class="px-2.5"
            />
            <UColorModeButton
              v-if="!colorMode.forced"
              color="neutral"
              variant="ghost"
              class="px-2.5"
            />
          </div>
        </template>
      </UDashboardSidebar>

      <UDashboardPanel
        :ui="{
          root: 'min-h-0 overflow-hidden bg-(--pluto-admin-canvas) lg:rounded-ss-xl',
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
