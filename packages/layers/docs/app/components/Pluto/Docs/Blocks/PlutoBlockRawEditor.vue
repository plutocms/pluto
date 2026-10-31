<script setup lang="ts">
// A Markdown box for one block that the visual editor does not edit as text:
// a table, HTML, a footnote, or any block that the author wants to edit as
// Markdown. `live` writes each key press (a Markdown block). Without it, the
// box has an Apply button, because a block of another kind is parsed again
// when the text changes.
const props = defineProps<{
  modelValue: string
  disabled?: boolean
  label: string
  live?: boolean
  rows?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t } = usePlutoI18n()

const draft = ref(props.modelValue)

watch(
  () => props.modelValue,
  (value) => {
    if (props.live || value !== draft.value) {
      draft.value = value
    }
  }
)

function update(value: string) {
  draft.value = value
  if (props.live) {
    emit('update:modelValue', value)
  }
}

const changed = computed(() => draft.value !== props.modelValue)
</script>

<template>
  <div class="flex flex-col gap-2">
    <PlutoMarkdownSource
      :model-value="draft"
      :disabled="disabled"
      :aria-label="label"
      :rows="rows ?? 8"
      @update:model-value="update"
    />
    <div v-if="!live" class="flex justify-end gap-2">
      <UButton
        :label="t('docs.editor.applyMarkdown')"
        :disabled="disabled || !changed"
        size="xs"
        color="primary"
        icon="i-lucide-check"
        @click="emit('update:modelValue', draft)"
      />
    </div>
  </div>
</template>
