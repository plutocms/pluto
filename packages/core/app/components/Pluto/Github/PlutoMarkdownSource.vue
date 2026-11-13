<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: string
    disabled?: boolean
    placeholder?: string
    rows?: number
    maxRows?: number
    ariaLabel?: string
    fill?: boolean
  }>(),
  {
    rows: 18,
    maxRows: 0,
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const textarea = useTemplateRef<{
  textareaRef: HTMLTextAreaElement | null
  autoResize: () => void
}>('textarea')

function element(): HTMLTextAreaElement | null {
  return textarea.value?.textareaRef ?? null
}

function focus(): void {
  element()?.focus()
}

function insert(
  text: string,
  options: {
    block?: boolean
  } = {}
): void {
  const el = element()
  const selection = el
    ? { start: el.selectionStart, end: el.selectionEnd }
    : { start: props.modelValue.length, end: props.modelValue.length }
  const result = insertMarkdownText(props.modelValue, selection, text, options)
  emit('update:modelValue', result.value)
  nextTick(() => {
    const target = element()
    if (target) {
      target.focus()
      target.setSelectionRange(result.caret, result.caret)
    }
  })
}

function goToLine(line: number): void {
  const el = element()
  if (!el) {
    return
  }
  const lines = props.modelValue.split('\n')
  const offset = lines
    .slice(0, Math.max(0, line))
    .reduce((sum, text) => sum + text.length + 1, 0)
  el.focus()
  el.setSelectionRange(offset, offset)
  const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight) || 24
  el.scrollTop = Math.max(0, line * lineHeight)
}

defineExpose({ insert, focus, goToLine })
</script>

<template>
  <div
    :class="fill ? 'flex h-full min-h-0 flex-col' : undefined"
    class="bg-default border-default w-full rounded-md border"
  >
    <div
      v-if="$slots.toolbar"
      class="border-default bg-default flex flex-wrap items-center gap-1 rounded-t-md border-b px-2 py-1.5"
    >
      <slot :insert="insert" :focus="focus" name="toolbar" />
    </div>
    <UTextarea
      ref="textarea"
      :model-value="modelValue"
      :disabled="disabled"
      :placeholder="placeholder"
      :rows="rows"
      :maxrows="maxRows"
      :aria-label="ariaLabel"
      :ui="{
        root: fill ? 'min-h-0 flex-1' : undefined,
        base: fill
          ? 'h-full resize-none px-4 py-3 font-mono text-sm/6 sm:px-4'
          : 'px-4 py-3 font-mono text-sm/6 sm:px-4',
      }"
      :autoresize="!fill"
      spellcheck="false"
      autocomplete="off"
      autocapitalize="off"
      variant="none"
      class="w-full"
      @update:model-value="emit('update:modelValue', $event as string)"
    />
  </div>
</template>
