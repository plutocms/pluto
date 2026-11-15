<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  disabled?: boolean
  placeholder?: string
  label: string
  compact?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t } = usePlutoI18n()

const touched = ref(false)
let echo = false

watch(
  () => props.modelValue,
  () => {
    echo = true
    nextTick(() => {
      echo = false
    })
  }
)

function onUpdate(value: string) {
  if (touched.value && !echo && value !== props.modelValue) {
    emit('update:modelValue', value)
  }
}

const shared = usePlutoMarkdownToolbar({ link: true })
const items = computed(() => shared.value.slice(1))
</script>

<template>
  <div
    class="w-full"
    @focusin="touched = true"
    @keydown.capture="touched = true"
    @pointerdown.capture="touched = true"
    @paste.capture="touched = true"
    @drop.capture="touched = true"
  >
    <UEditor
      v-slot="{ editor }"
      :model-value="modelValue"
      :editable="!disabled"
      :placeholder="placeholder ?? t('pluto.blocks.editor.textPlaceholder')"
      :starter-kit="{ undoRedo: false }"
      :image="false"
      :mention="false"
      :ui="{
        root: 'w-full',
        content: compact ? 'min-h-24 cursor-text' : 'min-h-48 cursor-text',
        base: compact
          ? 'min-h-24 px-3 py-2 sm:px-3'
          : 'min-h-48 px-3 py-2 sm:px-3',
      }"
      :aria-label="label"
      content-type="markdown"
      class="w-full rounded-md border border-default bg-default"
      @update:model-value="onUpdate($event as string)"
    >
      <UEditorToolbar
        :editor="editor"
        :items="items"
        :aria-label="t('pluto.github.editor.toolbar')"
        class="sticky top-0 z-10 flex-wrap rounded-t-md border-b border-default bg-default px-1.5 py-1"
      >
        <template #link>
          <PlutoGithubEditorLink :editor="editor" />
        </template>
      </UEditorToolbar>
    </UEditor>
  </div>
</template>
