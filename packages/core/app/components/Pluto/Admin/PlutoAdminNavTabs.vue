<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { tabs, action, label } = usePlutoAdminNavTabs()

// Set `active` by hand: a parent path such as `/admin/settings` must not be active on the pages below it.
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
