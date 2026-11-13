<script setup lang="ts">
import type { PlutoContentType } from '../../../../shared/types/content'

interface Props {
  type: PlutoContentType
  item?: Record<string, unknown>
  pending?: boolean
}

const props = defineProps<Props>()

const { t, d } = usePlutoI18n()
const text = usePlutoContentText(() => props.type)

const updatedAt = computed(() => {
  const timestamps = props.type.timestamps
  if (timestamps === false || !props.item) {
    return undefined
  }
  const key = timestamps?.updated || 'updatedAt'
  const value = props.item[key] ?? props.item.updatedAt
  const date = typeof value === 'string' ? new Date(value) : undefined
  return date && !Number.isNaN(date.getTime()) ? date : undefined
})

const status = computed(() => {
  if (props.pending) {
    return undefined
  }
  if (!props.item) {
    return t('pluto.content.singleton.notSaved')
  }
  return updatedAt.value
    ? t('pluto.content.singleton.lastSaved', {
        date: d(updatedAt.value, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
      })
    : undefined
})
</script>

<template>
  <div class="flex items-start gap-4">
    <div
      class="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-lg"
    >
      <UIcon :name="props.type.icon ?? 'lucide:file-text'" class="size-5" />
    </div>

    <div class="flex min-w-0 flex-col gap-1">
      <h1 class="text-highlighted text-xl font-semibold">
        {{ text.label }}
      </h1>

      <p v-if="text.description" class="text-muted text-sm">
        {{ text.description }}
      </p>

      <p v-if="status" class="text-dimmed text-xs">
        {{ status }}
      </p>
    </div>
  </div>
</template>
