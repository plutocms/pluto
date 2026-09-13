<script setup lang="ts">
const { items } = usePlutoDashboardWidgets()
</script>

<template>
  <div v-if="items.length" class="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-x-4 lg:gap-y-6">
    <div
      v-for="widget in items"
      :key="widget.id"
      :class="{ 'lg:col-span-2': widget.colSpan === 2, 'lg:col-span-3': widget.colSpan === 3 }"
    >
      <component :is="widget.component" />
    </div>
  </div>

  <UCard v-else>
    <p class="text-muted text-sm">
      No dashboard widgets are registered yet. A layer can add one with
      <code>definePlutoExtension</code>.
    </p>
  </UCard>
</template>
