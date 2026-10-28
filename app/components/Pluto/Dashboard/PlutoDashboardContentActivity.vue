<script setup lang="ts">
// Core's activity widget: items created per week, one series per content
// type. A trend over time, so it is a chart: an area for one series, lines
// for several (each with a legend entry). Series colors come from the admin
// theme's validated chart palette (--ui-chart-*). A visually hidden table
// carries the same numbers for assistive technology.
const WEEKS = 12

const { data: series, status, refresh } = usePlutoContentActivity(WEEKS)
const { t, n, d } = usePlutoI18n()
const texts = usePlutoContentTexts()

// The week starts are UTC dates. Format them in UTC so a viewer west of
// UTC does not see the previous day.
const weekLabel = (start: string) =>
  d(new Date(`${start}T00:00:00Z`), {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })

const rows = computed(() => {
  const first = series.value[0]
  if (!first) {
    return []
  }
  const last = first.points.length - 1
  return first.points.map((point, index) => {
    // The last point is the current week, so far. Its Monday is not today, so it
    // gets its own label.
    const row: Record<string, string | number> = {
      week:
        index === last
          ? t('pluto.dashboard.activity.thisWeek')
          : weekLabel(point.start),
    }
    for (const entry of series.value) {
      row[entry.name] = entry.points[index]?.count ?? 0
    }
    return row
  })
})

// The series carry the English labels. The content text resolves the keys.
const seriesLabel = (entry: PlutoContentActivitySeries) =>
  texts(entry.name).labelPlural
const categories = computed(() =>
  series.value.map((entry) => ({ key: entry.name, label: seriesLabel(entry) }))
)

const total = computed(() =>
  series.value.reduce(
    (sum, entry) =>
      sum + entry.points.reduce((acc, point) => acc + point.count, 0),
    0
  )
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
          <h3 class="text-highlighted font-semibold">
            {{ t('pluto.dashboard.activity.title') }}
          </h3>
          <p class="text-muted text-sm">
            {{ t('pluto.dashboard.activity.subtitle', { weeks: WEEKS }) }}
          </p>
        </div>
        <div v-if="status === 'success' && series.length" class="text-right">
          <p class="text-highlighted text-2xl font-semibold tabular-nums">
            {{ n(total) }}
          </p>
          <p class="text-muted text-xs">
            {{ t('pluto.dashboard.activity.created', total) }}
          </p>
        </div>
      </div>
    </template>

    <!-- The frame of the chart while the counts load: the y labels, the grid lines and the x labels. -->
    <div
      v-if="status === 'pending' || status === 'idle'"
      class="flex h-64 gap-3"
      aria-hidden="true"
    >
      <div class="flex flex-col justify-between pb-6">
        <USkeleton v-for="tick in 5" :key="tick" class="h-3 w-5" />
      </div>
      <div class="flex min-w-0 flex-1 flex-col">
        <div class="flex flex-1 flex-col justify-between py-1.5">
          <div
            v-for="tick in 5"
            :key="tick"
            class="h-px w-full bg-(--ui-border)"
          />
        </div>
        <div class="flex h-6 items-end justify-between">
          <USkeleton v-for="tick in 6" :key="tick" class="h-3 w-9" />
        </div>
      </div>
    </div>

    <UAlert
      v-else-if="status === 'error'"
      :actions="[
        {
          label: t('pluto.common.tryAgain'),
          color: 'error',
          variant: 'outline',
          onClick: retry,
        },
      ]"
      :title="t('pluto.dashboard.activity.loadFailed')"
      color="error"
      variant="subtle"
      icon="lucide:circle-alert"
    />

    <UEmpty
      v-else-if="!series.length"
      :title="t('pluto.dashboard.activity.unavailable')"
      :description="t('pluto.dashboard.activity.unavailableHint')"
      icon="lucide:chart-line"
      variant="naked"
    />

    <UEmpty
      v-else-if="total === 0"
      :title="t('pluto.dashboard.activity.none', { weeks: WEEKS })"
      :description="t('pluto.dashboard.activity.noneHint')"
      icon="lucide:chart-line"
      variant="naked"
    />

    <template v-else>
      <UChart
        :type="chartType"
        :data="rows"
        :categories="categories"
        :height="256"
        :format="(value: number) => n(value)"
        :aria-label="t('pluto.dashboard.activity.subtitle', { weeks: WEEKS })"
        index="week"
        curve="monotone"
      />

      <table class="sr-only">
        <caption>
          {{
            t('pluto.dashboard.activity.subtitle', { weeks: WEEKS })
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">
              {{ t('pluto.dashboard.activity.weekOf') }}
            </th>
            <th v-for="entry in series" :key="entry.name" scope="col">
              {{ seriesLabel(entry) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="String(row.week)">
            <th scope="row">
              {{ row.week }}
            </th>
            <td v-for="entry in series" :key="entry.name">
              {{ row[entry.name] }}
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </UCard>
</template>
