<script setup lang="ts">
// The parent of every Settings page: the title, the tabs, and the child route.
// A layer adds a tab with a file at `pages/admin/settings/<x>.vue` and a
// `settingsPages` entry. See the extension-registry skill.
import type { NavigationMenuItem } from '@nuxt/ui'

const { t } = usePlutoI18n()
const route = useRoute()

useHead({
  title: () => t('pluto.pages.settings'),
})

const { items, current, allowed } = usePlutoSettingsPages()

// Active state by hand: General (`/admin/settings`) matches exactly, so it is
// not active on the pages below it. Any other tab matches by prefix.
function isActive(to: string): boolean {
  const path = route.path.replace(/\/+$/, '') || '/'
  return to === '/admin/settings' ? path === to : path === to || path.startsWith(`${to}/`)
}

const tabs = computed<NavigationMenuItem[]>(() =>
  items.value.map((page) => ({
    label: page.label,
    icon: page.icon,
    href: page.to,
    active: isActive(page.to),
    onSelect: () => navigateTo(page.to),
  }))
)
</script>

<template>
  <main>
    <AdminView>
      <h1 class="text-3xl font-bold lg:text-4xl">{{ t('pluto.pages.settings') }}</h1>

      <!-- One page (General only) needs no tabs. -->
      <UNavigationMenu
        v-if="tabs.length >= 2"
        :items="tabs"
        :aria-label="t('pluto.settings.tabs.label')"
        orientation="horizontal"
        variant="link"
        class="border-default -mt-2 overflow-x-auto border-b"
      />

      <UAlert
        v-if="!allowed"
        :title="t('pluto.settings.noPermission.title')"
        :description="t('pluto.settings.noPermission.description', { page: current?.label ?? '' })"
        icon="lucide:lock"
        color="warning"
      />

      <NuxtPage v-else />
    </AdminView>
  </main>
</template>
