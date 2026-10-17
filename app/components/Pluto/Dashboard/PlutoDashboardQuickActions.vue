<script setup lang="ts">
// Core's quick actions widget. It reuses the command palette's commands, so
// the two never disagree: every "New <label>" command the user can run, and
// a few admin destinations.
const groups = usePlutoCommandPalette()

const create = computed(() => groups.value.find((group) => group.id === 'pluto-create')?.items ?? [])

const goTo = computed(() =>
  (groups.value.find((group) => group.id === 'pluto-go-to')?.items ?? [])
    // Home is the page this widget is on.
    .filter((item) => item.label !== 'Home')
    .slice(0, 4)
)

function run(item: {
 onSelect?: (event: Event) => void
}) {
  item.onSelect?.(new Event('select'))
}
</script>

<template>
  <UCard class="h-full">
    <template #header>
      <h3 class="text-highlighted font-semibold">Quick actions</h3>
      <p class="text-muted text-sm">
        Press
        <UKbd value="meta" size="sm" />
        <UKbd value="k" size="sm" />
        to search everything.
      </p>
    </template>

    <div class="flex flex-col gap-4">
      <div v-if="create.length" class="flex flex-col gap-2">
        <UButton
          v-for="item in create"
          :key="item.label"
          :label="item.label"
          icon="lucide:plus"
          color="neutral"
          variant="soft"
          size="md"
          class="justify-start"
          block
          @click="run(item)"
        />
      </div>

      <div v-if="goTo.length" class="flex flex-col gap-1">
        <p class="text-dimmed text-xs font-medium tracking-wide uppercase">Go to</p>
        <UButton
          v-for="item in goTo"
          :key="item.label"
          :label="item.label"
          :icon="typeof item.icon === 'string' ? item.icon : 'lucide:arrow-right'"
          :ui="{ trailingIcon: 'ms-auto text-dimmed' }"
          trailing-icon="lucide:chevron-right"
          color="neutral"
          variant="ghost"
          size="md"
          class="justify-start"
          block
          @click="run(item)"
        />
      </div>
    </div>
  </UCard>
</template>
