<script setup lang="ts">
// Core's activity widget: items created per week, one series per content
// type. A trend over time, so it is a chart: an area for one series, lines
// for several (each with a legend entry). Series colors come from the admin
// theme's validated chart palette (--ui-chart-*). A visually hidden table
// carries the same numbers for assistive technology.
const WEEKS = 12

const { data: series, status, refresh } = usePlutoContentActivity(WEEKS)

const number = new Intl.NumberFormat()
// The week starts are UTC dates. Format them in UTC so a viewer west of
// UTC does not see the previous day.
const weekLabel = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })

const rows = computed(() => {
  const first = series.value[0]
  if (!first) {
    return []
  }
  return first.points.map((point, index) => {
    const row: Record<string, string | number> = { week: weekLabel.format(new Date(`${point.start}T00:00:00Z`)) }
    for (const entry of series.value) {
      row[entry.name] = entry.points[index]?.count ?? 0
    }
    return row
  })
})

const categories = computed(() => series.value.map((entry) => ({ key: entry.name, label: entry.labelPlural })))

const total = computed(() =>
  series.value.reduce((sum, entry) => sum + entry.points.reduce((acc, point) => acc + point.count, 0), 0)
)

const chartType = computed(() => (series.value.length > 1 ? 'line' : 'area'))

function retry() {
  refresh()
}
</script>

<template>
  <UCard :ui="{ body: 'sm:pt-2' }" class="h-full">
    <template #header>
      <div class="flex items-start justify-between gap-4">
        <div>
          <h3 class="text-highlighted font-semibold">Content activity</h3>
          <p class="text-muted text-sm">Items created per week, last {{ WEEKS }} weeks</p>
        </div>
        <div v-if="status === 'success' && series.length" class="text-right">
          <p class="text-highlighted text-2xl font-semibold tabular-nums">{{ number.format(total) }}</p>
          <p class="text-muted text-xs">created</p>
        </div>
      </div>
    </template>

    <USkeleton v-if="status === 'pending' || status === 'idle'" class="h-64 w-full" />

    <UAlert
      v-else-if="status === 'error'"
      :actions="[{ label: 'Try again', color: 'error', variant: 'outline', onClick: retry }]"
      color="error"
      variant="subtle"
      icon="lucide:circle-alert"
      title="Could not load the activity"
    />

    <UEmpty
      v-else-if="!series.length"
      icon="lucide:chart-line"
      title="Activity is not available"
      description="The content backend cannot count items by creation date yet."
      variant="naked"
    />

    <UEmpty
      v-else-if="total === 0"
      :title="`Nothing created in the last ${WEEKS} weeks`"
      icon="lucide:chart-line"
      description="New items show up here week by week."
      variant="naked"
    />

    <template v-else>
      <UChart
        :type="chartType"
        :data="rows"
        :categories="categories"
        :height="256"
        :format="(value: number) => number.format(value)"
        :aria-label="`Items created per week, last ${WEEKS} weeks`"
        index="week"
        curve="monotone"
      />

      <table class="sr-only">
        <caption>Items created per week, last {{ WEEKS }} weeks</caption>
        <thead>
          <tr>
            <th scope="col">Week of</th>
            <th v-for="entry in series" :key="entry.name" scope="col">{{ entry.labelPlural }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="String(row.week)">
            <th scope="row">{{ row.week }}</th>
            <td v-for="entry in series" :key="entry.name">{{ row[entry.name] }}</td>
          </tr>
        </tbody>
      </table>
    </template>
  </UCard>
</template>
