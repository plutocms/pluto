<script setup lang="ts">
import type { PlutoFormField } from '../../shared/types/forms'

interface Props {
  field: PlutoFormField
  id: string
  modelValue?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
})
</script>

<template>
  <input
    :id="props.id"
    :name="props.field.name"
    :value="props.modelValue ?? props.field.value ?? ''"
    type="hidden"
  />
</template>
