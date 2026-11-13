<script setup lang="ts">
const props = defineProps<{
  field: PlutoField
  modelValue: unknown
  disabled?: boolean
  type?: string
  canvas?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: unknown]
  ready: []
}>()

const widget = usePlutoContentFieldWidget(props.field)

const { t } = usePlutoI18n()
const { byName } = usePlutoContentTypes()
const text = usePlutoContentText(() =>
  props.type ? byName(props.type) : undefined
)

const translated = computed(() =>
  props.type ? text.field(props.field) : props.field
)
</script>

<template>
  <Suspense v-if="widget" @resolve="emit('ready')">
    <component
      :is="widget"
      :field="translated"
      :model-value="modelValue"
      :disabled="disabled"
      @update:model-value="emit('update:modelValue', $event)"
    />

    <template #fallback>
      <PlutoSkeletonCanvas v-if="canvas" />
      <PlutoSkeletonField v-else :field="field" />
    </template>
  </Suspense>

  <UFormField v-else :label="translated.label">
    <p class="text-muted text-sm">
      {{ t('pluto.fields.noWidget', { type: field.type }) }}
    </p>
  </UFormField>
</template>
