<script setup lang="ts">
withDefaults(
  defineProps<{
    columns: string[]
    status?: boolean
    rows?: number
  }>(),
  { status: false, rows: 8 }
)

const widths = ['w-3/4', 'w-1/2', 'w-2/3', 'w-2/5', 'w-3/5', 'w-1/3']
</script>

<template>
  <div role="status">
    <div
      class="ring-default hidden overflow-hidden rounded-lg ring lg:block"
      aria-hidden="true"
    >
      <table class="w-full table-fixed text-sm">
        <thead class="border-default border-b">
          <tr>
            <th
              v-for="column in columns"
              :key="column"
              class="text-highlighted px-4 py-3.5 text-left font-semibold"
            >
              {{ column }}
            </th>
            <th v-if="status" class="w-32 px-4 py-3.5" />
            <th class="w-36 px-4 py-3.5" />
          </tr>
        </thead>
        <tbody class="divide-default divide-y">
          <tr v-for="row in rows" :key="row">
            <td v-for="(column, index) in columns" :key="column" class="p-4">
              <USkeleton
                :class="widths[(row + index) % widths.length]"
                class="h-4"
              />
            </td>
            <td v-if="status" class="p-4">
              <USkeleton class="h-5 w-20 rounded-full" />
            </td>
            <td class="p-4">
              <div class="flex justify-end gap-3">
                <USkeleton class="h-4 w-8" />
                <USkeleton class="h-4 w-14" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex flex-col gap-3 lg:hidden" aria-hidden="true">
      <UCard v-for="card in 3" :key="card">
        <div class="flex flex-col gap-4">
          <div class="flex items-center justify-between gap-3">
            <USkeleton class="h-6 w-1/2" />
            <USkeleton v-if="status" class="h-5 w-16 rounded-full" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div
              v-for="column in Math.max(columns.length - 1, 1)"
              :key="column"
              class="flex flex-col gap-1.5"
            >
              <USkeleton class="h-3.5 w-16" />
              <USkeleton class="h-4 w-24" />
            </div>
          </div>
          <div class="border-default flex gap-2 border-t pt-3">
            <USkeleton class="h-9 flex-1" />
            <USkeleton class="h-9 flex-1" />
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
