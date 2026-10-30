<script setup lang="ts">
// Dispatches to whichever widget is registered for `field`, and re-emits
// `update:modelValue` unchanged. Never needs to know which concrete widget
// it dispatched to — every widget shares the same field/modelValue/disabled
// contract (see the content-model skill).
const props = defineProps<{
  field: PlutoField
  modelValue: unknown
  disabled?: boolean
  /**
   * A content type's `name`. Set it so the field text uses the
   * `content.<name>.fields.*` translation keys. Without it, the field keeps
   * its own English text.
   */
  type?: string
  /** The canvas field of a canvas form: the loading skeleton has the shape of a page. */
  canvas?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: unknown]
  /** The widget code loaded and the widget rendered. */
  ready: []
}>()

const widget = usePlutoContentFieldWidget(props.field)

const { t } = usePlutoI18n()
const { byName } = usePlutoContentTypes()
const text = usePlutoContentText(() =>
  props.type ? byName(props.type) : undefined
)

// The widget gets a translated copy, so a widget from any layer shows the
// translated text with no change. Without a type, the copy keeps the original.
const translated = computed(() =>
  props.type ? text.field(props.field) : props.field
)
</script>

<template>
  <!--
    Own Suspense boundary. A widget that loads on demand shows a skeleton for
    this field only. The form and the page do not wait for its chunk.
  -->
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
