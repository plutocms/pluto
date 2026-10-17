<script setup lang="ts">
useHead({
  title: 'Dashboard',
})

const today = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())

// The header's Create button reuses the command palette's Create commands.
const groups = usePlutoCommandPalette()
const createItems = computed(() => groups.value.find((group) => group.id === 'pluto-create')?.items ?? [])

function run(item: {
 onSelect?: (event: Event) => void
}) {
  item.onSelect?.(new Event('select'))
}
</script>

<template>
  <PlutoViewAdminPanel>
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-muted text-sm">{{ today }}</p>
        <h1 class="text-highlighted text-2xl font-semibold tracking-tight lg:text-3xl">Dashboard</h1>
      </div>

      <UButton
        v-if="createItems.length === 1"
        :label="createItems[0]!.label"
        icon="lucide:plus"
        size="md"
        @click="run(createItems[0]!)"
      />

      <UDropdownMenu v-else-if="createItems.length > 1" :items="createItems" :content="{ align: 'end' }">
        <UButton label="Create" icon="lucide:plus" trailing-icon="lucide:chevron-down" size="md" />
      </UDropdownMenu>
    </header>

    <PlutoDashboardWidgets />
  </PlutoViewAdminPanel>
</template>
