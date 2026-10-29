<script setup lang="ts">
// The core `media` widget. The value is one media id, or a list of ids in
// order (`multiple`). The picker gives the files; the records of the ids load
// from the library. A deleted file shows as a "Deleted file" tile until
// someone removes it. See the media skill.
import type { PlutoMedia } from '../../../../../shared/types/media'
import { mediaFieldIds } from '../../../../../shared/utils/media'

const props = defineProps<{
  field: PlutoMediaField
  modelValue: unknown
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | string[] | null]
}>()

const { t } = usePlutoI18n()
const media = usePlutoMedia()

const ids = computed(() => mediaFieldIds(props.modelValue))
const records = ref(new Map<string, PlutoMedia>())
const pickerOpen = ref(false)

async function loadRecords() {
  const missing = ids.value.filter((id) => !records.value.has(id))
  if (missing.length === 0 || !media.enabled) {
    return
  }
  try {
    for (const record of await media.get(missing)) {
      records.value.set(record.id, record)
    }
    records.value = new Map(records.value)
  } catch {
    // The tiles show the ids as deleted files. The form still works.
  }
}

watch(ids, loadRecords, { immediate: true })

function emitIds(next: string[]) {
  emit('update:modelValue', props.field.multiple ? next : (next[0] ?? null))
}

function onSelect(chosen: PlutoMedia[]) {
  for (const record of chosen) {
    records.value.set(record.id, record)
  }
  const chosenIds = chosen.map((record) => record.id)
  emitIds(
    props.field.multiple
      ? [...ids.value, ...chosenIds.filter((id) => !ids.value.includes(id))]
      : chosenIds.slice(0, 1)
  )
}

function removeAt(index: number) {
  emitIds(ids.value.filter((_, position) => position !== index))
}

function move(index: number, step: -1 | 1) {
  const next = [...ids.value]
  const target = index + step
  if (target < 0 || target >= next.length) {
    return
  }
  ;[next[index], next[target]] = [next[target] as string, next[index] as string]
  emitIds(next)
}
</script>

<template>
  <UFormField
    :label="field.label"
    :description="field.description"
    :required="field.required"
  >
    <!-- One file: a tile, Change and Remove. -->
    <div v-if="!field.multiple" class="flex items-end gap-3">
      <button
        :disabled="disabled"
        :aria-label="
          ids.length
            ? t('pluto.media.field.change')
            : t('pluto.media.field.choose')
        "
        type="button"
        class="group/tile w-32 shrink-0 rounded-lg disabled:opacity-60"
        @click="pickerOpen = true"
      >
        <PlutoMediaTile v-if="ids[0]" :media="records.get(ids[0])" />
        <div
          v-else
          class="border-default text-muted group-hover/tile:border-accented flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-xs"
        >
          <UIcon name="lucide:image-plus" class="size-6" />
          {{ t('pluto.media.field.choose') }}
        </div>
      </button>

      <div v-if="ids.length" class="flex flex-col gap-1.5">
        <UButton
          :label="t('pluto.media.field.change')"
          :disabled="disabled"
          color="neutral"
          variant="outline"
          size="sm"
          @click="pickerOpen = true"
        />
        <UButton
          :label="t('pluto.media.field.remove')"
          :disabled="disabled"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="emitIds([])"
        />
      </div>
    </div>

    <!-- Many files: a strip in order, and an Add tile. -->
    <ul
      v-else
      class="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2"
    >
      <li v-for="(id, index) in ids" :key="id" class="group/tile relative">
        <PlutoMediaTile :media="records.get(id)" />
        <div
          v-if="!disabled"
          class="absolute inset-x-1 bottom-1 flex justify-between gap-1 opacity-0 transition-opacity group-focus-within/tile:opacity-100 group-hover/tile:opacity-100"
        >
          <div class="flex gap-1">
            <UButton
              :aria-label="t('pluto.media.field.moveLeft')"
              :disabled="index === 0"
              icon="lucide:chevron-left"
              color="neutral"
              variant="solid"
              size="xs"
              @click="move(index, -1)"
            />
            <UButton
              :aria-label="t('pluto.media.field.moveRight')"
              :disabled="index === ids.length - 1"
              icon="lucide:chevron-right"
              color="neutral"
              variant="solid"
              size="xs"
              @click="move(index, 1)"
            />
          </div>
          <UButton
            :aria-label="t('pluto.media.field.remove')"
            icon="lucide:x"
            color="error"
            variant="solid"
            size="xs"
            @click="removeAt(index)"
          />
        </div>
      </li>
      <li>
        <button
          :disabled="disabled"
          type="button"
          class="border-default text-muted hover:border-accented flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-xs disabled:opacity-60"
          @click="pickerOpen = true"
        >
          <UIcon name="lucide:image-plus" class="size-6" />
          {{ t('pluto.media.field.add') }}
        </button>
      </li>
    </ul>

    <PlutoMediaPicker
      v-model:open="pickerOpen"
      :multiple="field.multiple"
      :accept="field.accept"
      @select="onSelect"
    />
  </UFormField>
</template>
