<script setup lang="ts">
// The tabs All and Trash of a list, for a type with `trash`. The Trash tab is the route query
// `?trash=1` of the same page: an id can be "trash", so the trash cannot be a path under the list.
const props = defineProps<{
  /** The open tab. */
  view: 'all' | 'trash'
  /** The number of trashed items. `null` hides the badge. */
  count: number | null
}>()

const { t, n } = usePlutoI18n()
const route = useRoute()

const items = computed(() => {
  const query = { ...route.query }
  delete query.trash
  return [
    {
      label: t('pluto.list.trash.tabAll'),
      icon: 'lucide:list',
      to: { query },
      active: props.view === 'all',
    },
    {
      label: t('pluto.list.trash.tabTrash'),
      icon: 'lucide:trash-2',
      to: { query: { trash: '1' } },
      active: props.view === 'trash',
      ...(props.count ? { badge: n(props.count) } : {}),
    },
  ]
})
</script>

<template>
  <UDashboardToolbar :ui="{ root: 'border-muted' }">
    <UNavigationMenu
      :items="items"
      :aria-label="t('pluto.list.trash.tabs')"
      orientation="horizontal"
      variant="link"
      class="-mx-1 min-w-0 flex-1 overflow-x-auto"
      highlight
    />
  </UDashboardToolbar>
</template>
