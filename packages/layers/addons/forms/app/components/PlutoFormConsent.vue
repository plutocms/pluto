<script setup lang="ts">
import type { PlutoFormField } from '../../shared/types/forms'

interface Props {
  field: PlutoFormField
  id: string
  modelValue?: unknown
  error?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  error: undefined,
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const { t } = usePlutoSiteI18n()

function onChange(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).checked)
}
</script>

<template>
  <PlutoFormControl
    :id="props.id"
    :field="props.field"
    :error="props.error"
    inline
  >
    <template #default="{ describedby, invalid }">
      <label class="pluto-form__option">
        <input
          :id="props.id"
          :name="props.field.name"
          :checked="props.modelValue === true"
          :disabled="props.disabled"
          :aria-required="props.field.required ? 'true' : undefined"
          :aria-invalid="invalid ? 'true' : undefined"
          :aria-describedby="describedby"
          type="checkbox"
          class="pluto-form__checkbox"
          @change="onChange"
        />

        <span>
          {{ props.field.label }}

          <span
            v-if="props.field.required"
            class="pluto-form__required"
            aria-hidden="true"
          >
            *
          </span>

          <a
            v-if="props.field.link"
            :href="props.field.link"
            class="pluto-form__link"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ t('forms.consent.read') }}
          </a>
        </span>
      </label>
    </template>
  </PlutoFormControl>
</template>
