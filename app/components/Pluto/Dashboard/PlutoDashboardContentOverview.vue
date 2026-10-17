<script setup lang="ts">
// Core's own dashboard widget: one stat tile per content type. Counts are
// a handful of headline numbers, so they show as tiles, not as a chart. A
// type with a status workflow also shows a meter of its published share.
// The meter has a text label next to it, so the share never depends on
// color alone. "+N this week" comes from the shared activity data, so it
// costs no extra request.
const { items: contentTypes } = usePlutoContentTypes()
const { stats, pending, error, refresh } = usePlutoContentStats()
const { data: activity } = usePlutoContentActivity()

const number = new Intl.NumberFormat()

function retry() {
  refresh().catch(() => {})
}

function publishedPercent(stat: PlutoContentStat): number {
  return stat.total > 0 ? Math.round(((stat.published ?? 0) / stat.total) * 100) : 0
}

/** Items created this week, or `undefined` when activity is not available. */
function thisWeek(stat: PlutoContentStat): number | undefined {
  return activity.value.find((entry) => entry.name === stat.name)?.points.at(-1)?.count
}
</script>

<template>
  <section v-if="contentTypes.length" aria-label="Content overview">
    <UAlert
      v-if="error && !stats.length"
      :actions="[{ label: 'Try again', color: 'error', variant: 'outline', onClick: retry }]"
      color="error"
      variant="subtle"
      icon="lucide:circle-alert"
      title="Could not load the content counts"
    />

    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <template v-if="pending && !stats.length">
        <UCard v-for="entry in contentTypes" :key="entry.id">
          <div class="flex flex-col gap-3">
            <USkeleton class="h-4 w-24" />
            <USkeleton class="h-8 w-16" />
            <USkeleton class="h-1.5 w-full" />
          </div>
        </UCard>
      </template>

      <NuxtLink
        v-for="stat in stats"
        v-else
        :key="stat.name"
        :to="stat.path"
        class="group focus-visible:outline-primary rounded-lg focus-visible:outline-2"
      >
        <UCard class="group-hover:ring-accented h-full transition-shadow group-hover:shadow-sm">
          <div class="flex flex-col gap-3">
            <div class="flex items-start justify-between gap-3">
              <p class="text-muted text-sm font-medium">{{ stat.labelPlural }}</p>
              <span class="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-md">
                <UIcon :name="stat.icon ?? 'lucide:file'" class="size-4" />
              </span>
            </div>

            <div class="flex items-baseline gap-2">
              <p class="text-highlighted text-3xl font-semibold tracking-tight tabular-nums">
                {{ number.format(stat.total) }}
              </p>
              <p v-if="thisWeek(stat) !== undefined" class="text-sm">
                <template v-if="thisWeek(stat)">
                  <span class="text-success font-medium tabular-nums">+{{ number.format(thisWeek(stat)!) }}</span>
                  <span class="text-muted"> this week</span>
                </template>
                <span v-else class="text-dimmed">none new this week</span>
              </p>
            </div>

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
