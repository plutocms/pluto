<script setup lang="ts">
const { items } = usePlutoDashboardWidgets()
const { t } = usePlutoI18n()

// A fixed height per column span limits the layout shift when the widget loads.
function skeletonHeight(colSpan?: number): string {
  if (colSpan === 3) {
    return '9rem'
  }
  return colSpan === 2 ? '24rem' : '12rem'
}
</script>

<template>
  <div
    v-if="items.length"
    class="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-x-4 lg:gap-y-6"
  >
    <div
      v-for="widget in items"
      :key="widget.id"
      :class="{
        'lg:col-span-2': widget.colSpan === 2,
        'lg:col-span-3': widget.colSpan === 3,
      }"
    >
      <!-- Own Suspense boundary: a slow widget chunk does not block the grid. -->
      <Suspense>
        <component :is="widget.component" />

        <template #fallback>
          <PlutoSkeletonWidget :height="skeletonHeight(widget.colSpan)" />
        </template>
      </Suspense>
    </div>
  </div>

  <UCard v-else>
    <p class="text-muted text-sm">
      {{ t('pluto.dashboard.noWidgets') }}
      <code>definePlutoExtension</code>.
    </p>
  </UCard>
</template>
