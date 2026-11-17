<script setup lang="ts">
import type { PlutoFormField } from '../../shared/types/forms'

interface Props {
  field: PlutoFormField
  id: string
  modelValue?: string
  error?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  error: undefined,
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <PlutoFormControl
    :id="props.id"
    :field="props.field"
    :error="props.error"
    group
  >
    <template #default="{ describedby, invalid }">
      <div
        :aria-describedby="describedby"
        :aria-invalid="invalid ? 'true' : undefined"
        class="pluto-form__options"
        role="radiogroup"
      >
        <label
          v-for="(option, index) in props.field.options"
          :key="option.value"
          class="pluto-form__option"
        >
          <input
            :id="index === 0 ? props.id : undefined"
            :name="props.field.name"
            :value="option.value"
            :checked="props.modelValue === option.value"
            :disabled="props.disabled"
            type="radio"
            class="pluto-form__radio"
            @change="emit('update:modelValue', option.value)"
          />

          <span>{{ option.label }}</span>
        </label>
      </div>
    </template>
  </PlutoFormControl>
</template>
