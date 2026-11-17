<script setup lang="ts">
import type { PlutoFormField } from '../../shared/types/forms'

interface Props {
  field: PlutoFormField
  id: string
  error?: string
  group?: boolean
  inline?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  error: undefined,
  group: false,
  inline: false,
})

const helpId = computed(() =>
  props.field.help ? `${props.id}-help` : undefined
)

const errorId = computed(() => (props.error ? `${props.id}-error` : undefined))

const describedby = computed(
  () => [helpId.value, errorId.value].filter(Boolean).join(' ') || undefined
)
</script>

<template>
  <component
    :is="props.group ? 'fieldset' : 'div'"
    :class="{
      'pluto-form__field--half': props.field.width === 'half',
      'pluto-form__field--invalid': props.error,
    }"
    class="pluto-form__field"
  >
    <component
      :is="props.group ? 'legend' : 'label'"
      v-if="!props.inline"
      :for="props.group ? undefined : props.id"
      class="pluto-form__label"
    >
      {{ props.field.label }}

      <span
        v-if="props.field.required"
        class="pluto-form__required"
        aria-hidden="true"
      >
        *
      </span>
    </component>

    <slot :describedby="describedby" :invalid="Boolean(props.error)" />

    <p v-if="props.field.help" :id="helpId" class="pluto-form__help">
      {{ props.field.help }}
    </p>

    <p v-if="props.error" :id="errorId" class="pluto-form__error">
      {{ props.error }}
    </p>
  </component>
</template>
