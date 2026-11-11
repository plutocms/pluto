<script setup lang="ts">
// The tabs of the section of the page: the children of the menu item whose submenu holds the page
// (usePlutoAdminNavTabs), in a bar under the toolbar of the page (`#toolbar` of
// PlutoViewAdminPanel, after the PlutoViewToolbar). The "new" child of the section is a button at
// the end of the tabs, not a tab. Nothing shows when the page is in no submenu.
import type { NavigationMenuItem } from '@nuxt/ui'

const { tabs, action, label } = usePlutoAdminNavTabs()

// The active tab is set by hand (`active`), not by the router: a parent path
// such as `/admin/settings` must not be active on the pages below it.
const items = computed<NavigationMenuItem[]>(() =>
  tabs.value.map((tab) => ({
    label: tab.label,
    icon: tab.icon,
    href: tab.to,
    active: tab.active,
    onSelect: () => navigateTo(tab.to),
  }))
)
</script>

<template>
  <UDashboardToolbar v-if="items.length > 0" :ui="{ root: 'border-muted' }">
    <UNavigationMenu
      :items="items"
      :aria-label="label"
      orientation="horizontal"
      variant="link"
      class="-mx-1 min-w-0 flex-1 overflow-x-auto"
      highlight
    />
    <UButton
      v-if="action"
      :to="action.to"
      :label="action.label"
      icon="i-lucide-plus"
      color="neutral"
      variant="ghost"
      size="sm"
      class="shrink-0"
    />
  </UDashboardToolbar>
</template>
