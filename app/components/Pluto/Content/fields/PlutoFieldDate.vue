<script setup lang="ts">
// UInputDate's modelValue is a `DateValue` (from `@internationalized/date`),
// not a plain string. A content item stores a 'date' field as a plain ISO
// date string ('YYYY-MM-DD'), so this widget converts both ways at its own
// boundary — the rest of the content model never sees a `DateValue`.
import type { CalendarDate, DateValue } from '@internationalized/date'
import { parseDate } from '@internationalized/date'

const props = defineProps<{
  field: PlutoDateField
  modelValue: unknown
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | undefined]
}>()

function toCalendarDate(value: unknown): CalendarDate | undefined {
  if (typeof value !== 'string' || value === '') {
    return undefined
  }

  try {
    return parseDate(value.slice(0, 10))
  } catch {
    return undefined
  }
}

const value = computed<DateValue | undefined>({
  get: () => toCalendarDate(props.modelValue),
  set: (next) => emit('update:modelValue', next ? next.toString() : undefined),
})
</script>

<template>
  <UFormField :label="field.label" :description="field.description" :required="field.required">
    <UInputDate v-model="value" :disabled="disabled" />
  </UFormField>
</template>
