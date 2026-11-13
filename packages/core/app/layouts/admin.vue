<script setup lang="ts">
const menu = usePlutoAdminMenu()
const openGroups = usePlutoAdminMenuGroups()
const isSidebarOpen = usePlutoAdminMenuOpen()
usePlutoBackClose(isSidebarOpen, useMediaQuery('(max-width: 63.99rem)'))

const commandGroups = usePlutoCommandPalette()
const { t } = usePlutoI18n()
const colorMode = useColorMode()

const banners = usePlutoRegistry().adminBanners.list

usePlutoAdminTheme()

// An inline `top` wins over the group class. A class replacer is ignored here (@nuxt/ui 4.12).
const groupStyle = { top: 'var(--pluto-admin-bar-height)' }

const sidebarCollapsed = ref(false)
usePlutoZenPanel(
  computed({
    get: () => !sidebarCollapsed.value,
    set: (open) => {
      sidebarCollapsed.value = !open
    },
  })
)
</script>

<template>
  <PlutoAdminTheme>
    <UDashboardGroup
      :style="groupStyle"
      class="bg-(--pluto-admin-navbar)"
      storage="cookie"
      storage-key="pluto-admin"
      unit="rem"
    >
      <UDashboardSidebar
        id="admin"
        v-model:open="isSidebarOpen"
        v-model:collapsed="sidebarCollapsed"
        :default-size="16.25"
        :min-size="12"
        :max-size="24"
        :ui="{
          root: 'min-h-0 border-e-0 bg-(--pluto-admin-navbar)',
          content: 'lg:hidden w-[min(18rem,85vw)] bg-(--pluto-admin-navbar)',
          header: 'h-auto py-3',
          body: 'gap-0 overflow-hidden p-0 sm:px-0',
          footer:
            'border-default max-lg:hidden border-t in-data-[collapsed=true]:border-transparent',
          handle:
            'before:-inset-x-0.75 before:transition-colors before:duration-150! hover:before:bg-haze-400 hover:before:delay-300! active:before:bg-haze-400 active:before:delay-0!',
        }"
        :collapsed-size="4.5"
        data-pluto-admin-dark
        resizable
        collapsible
      >
        <template #header="{ collapsed }">
          <UDashboardSearchButton
            :collapsed="collapsed"
            :class="collapsed ? 'px-2.5' : 'w-full'"
            variant="soft"
          />
        </template>

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
          // The scrollbar gutter keeps the content from moving sideways between pages.
          body: 'p-0 sm:p-0 gap-0 sm:gap-0 overflow-x-hidden scrollbar-gutter-stable has-data-pluto-view:scrollbar-gutter-auto',
        }"
      >
        <template #body>
          <Suspense v-for="banner in banners" :key="banner.id">
            <component :is="banner.component" />

            <template #fallback />
          </Suspense>
          <slot />
        </template>
      </UDashboardPanel>

      <UDashboardSearch
        :groups="commandGroups"
        :placeholder="t('pluto.palette.placeholder')"
        :ui="{ modal: 'pluto-admin-search' }"
      />
    </UDashboardGroup>
  </PlutoAdminTheme>
</template>
