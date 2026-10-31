<script setup lang="ts">
// The tabs of the section of the page: the children of the menu item whose
// submenu holds the page (usePlutoAdminNavTabs). Nothing shows when the page
// is in no submenu. `page`: under the title of a page (Settings, Users).
// `toolbar`: a bar under the toolbar of a list page.
import type { NavigationMenuItem } from '@nuxt/ui'

withDefaults(
  defineProps<{
    variant?: 'page' | 'toolbar'
  }>(),
  { variant: 'page' }
)

const { tabs, label } = usePlutoAdminNavTabs()

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
  <template v-if="items.length > 0">
    <UDashboardToolbar
      v-if="variant === 'toolbar'"
      :ui="{ root: 'border-muted' }"
    >
      <UNavigationMenu
        :items="items"
        :aria-label="label"
        orientation="horizontal"
        variant="link"
        class="-mx-1 flex-1 overflow-x-auto"
        highlight
      />
    </UDashboardToolbar>

    <UNavigationMenu
      v-else
      :items="items"
      :aria-label="label"
      orientation="horizontal"
      variant="link"
      class="border-default -mt-2 overflow-x-auto border-b"
    />
  </template>
</template>
