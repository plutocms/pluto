<script setup lang="ts">
// The switch between the Visual and the Markdown editor of the page body.
const props = defineProps<{
  mode: 'visual' | 'markdown'
  disabled?: boolean
  /** Visual is off, for example when the layout has no canvas. */
  visualDisabled?: boolean
}>()

const emit = defineEmits<{
  'update:mode': [mode: 'visual' | 'markdown']
}>()

const { t } = usePlutoI18n()

function pick(mode: 'visual' | 'markdown') {
  if (mode !== props.mode) {
    emit('update:mode', mode)
  }
}
</script>

<template>
  <div :aria-label="t('docs.editor.mode')" role="group" class="flex gap-1">
    <UButton
      :variant="mode === 'visual' ? 'solid' : 'outline'"
      :aria-pressed="mode === 'visual'"
      :disabled="disabled || visualDisabled"
      :label="t('docs.editor.visual')"
      size="xs"
      color="neutral"
      icon="i-lucide-layout-panel-left"
      @click="pick('visual')"
    />
    <UButton
      :variant="mode === 'markdown' ? 'solid' : 'outline'"
      :aria-pressed="mode === 'markdown'"
      :disabled="disabled"
      :label="t('docs.editor.markdown')"
      size="xs"
      color="neutral"
      icon="i-lucide-file-code"
      @click="pick('markdown')"
    />
  </div>
</template>
