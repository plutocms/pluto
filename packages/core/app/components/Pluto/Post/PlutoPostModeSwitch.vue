<script setup lang="ts">
const props = defineProps<{
  mode: 'visual' | 'markdown'
  disabled?: boolean
  visualBlocked?: boolean
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
  <div
    :aria-label="t('pluto.post.mode')"
    class="flex gap-1"
    role="group"
    @mousedown.prevent
  >
    <UTooltip
      :text="t('pluto.post.visualBlocked')"
      :disabled="!visualBlocked"
      :content="{ side: 'top' }"
    >
      <span class="inline-flex">
        <UButton
          :variant="mode === 'visual' ? 'solid' : 'outline'"
          :aria-pressed="mode === 'visual'"
          :disabled="disabled || visualBlocked"
          :label="t('pluto.post.visual')"
          size="xs"
          color="neutral"
          icon="i-lucide-pen-line"
          @click="pick('visual')"
        />
      </span>
    </UTooltip>
    <UButton
      :variant="mode === 'markdown' ? 'solid' : 'outline'"
      :aria-pressed="mode === 'markdown'"
      :disabled="disabled"
      :label="t('pluto.post.markdown')"
      size="xs"
      color="neutral"
      icon="i-lucide-file-code"
      @click="pick('markdown')"
    />
  </div>
</template>
