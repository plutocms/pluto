<script setup lang="ts">
// Core's own dashboard widget: one stat tile per content type. Counts are
// a handful of headline numbers, so they show as tiles, not as a chart. A
// type with a status workflow also shows a meter of its published share.
// The meter has a text label next to it, so the share never depends on
// color alone.
const { items: contentTypes } = usePlutoContentTypes()
const { stats, pending, error, refresh } = usePlutoContentStats()

const number = new Intl.NumberFormat()

function retry() {
  refresh().catch(() => {})
}

function publishedPercent(stat: PlutoContentStat): number {
  return stat.total > 0 ? Math.round(((stat.published ?? 0) / stat.total) * 100) : 0
}
</script>

<template>
  <section v-if="contentTypes.length" class="flex flex-col gap-3" aria-labelledby="pluto-content-overview">
    <h2 id="pluto-content-overview" class="text-highlighted text-lg font-semibold">Content</h2>

    <UAlert
      v-if="error && !stats.length"
      :actions="[{ label: 'Try again', color: 'error', variant: 'outline', onClick: retry }]"
      color="error"
      variant="subtle"
      icon="lucide:circle-alert"
      title="Could not load the content counts"
    />

    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <template v-if="pending && !stats.length">
        <UCard v-for="entry in contentTypes" :key="entry.id">
          <div class="flex flex-col gap-3">
            <USkeleton class="h-4 w-24" />
            <USkeleton class="h-9 w-16" />
            <USkeleton class="h-1.5 w-full" />
          </div>
        </UCard>
      </template>

      <NuxtLink
        v-for="stat in stats"
        v-else
        :key="stat.name"
        :to="stat.path"
        class="group rounded-lg focus-visible:outline-2 focus-visible:outline-primary"
      >
        <UCard class="h-full transition-colors group-hover:ring-accented">
          <div class="flex flex-col gap-3">
            <p class="text-muted flex items-center gap-2 text-sm">
              <UIcon :name="stat.icon ?? 'lucide:file'" class="size-4" />
              {{ stat.labelPlural }}
            </p>

            <p class="text-highlighted text-4xl font-semibold tabular-nums">
              {{ number.format(stat.total) }}
            </p>

            <template v-if="stat.published !== undefined">
              <div
                :aria-valuenow="stat.published"
                :aria-valuemax="stat.total"
                :aria-label="`${stat.published} of ${stat.total} ${stat.labelPlural.toLowerCase()} published`"
                role="meter"
                aria-valuemin="0"
                class="bg-accented flex h-1.5 overflow-hidden rounded-full"
              >
                <div :style="{ width: `${publishedPercent(stat)}%` }" class="bg-primary rounded-full" />
              </div>

              <p class="text-muted text-sm">
                <span class="text-highlighted font-medium tabular-nums">{{ number.format(stat.published) }}</span>
                published ·
                <span class="tabular-nums">{{ number.format(stat.drafts ?? 0) }}</span>
                {{ stat.drafts === 1 ? 'draft' : 'drafts' }}
              </p>
            </template>
          </div>
        </UCard>
      </NuxtLink>
    </div>
  </section>
</template>
