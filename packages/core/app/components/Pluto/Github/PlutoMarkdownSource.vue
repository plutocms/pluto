<script setup lang="ts">
// A raw Markdown editor: a monospace textarea that grows with the text. The
// model value is the Markdown text, as it is. Nothing parses or rewrites it,
// so MDC, HTML and tables stay as the author wrote them.
//
// A layer can use it as a base for its own widget. The `toolbar` slot sits
// above the text. `insert` and `focus` are exposed for a toolbar button. The
// CMS module registers the short name `PlutoMarkdownSource`.
const props = withDefaults(
  defineProps<{
    modelValue: string
    disabled?: boolean
    placeholder?: string
    /** The minimum height in rows. Default 18. */
    rows?: number
    /** The box grows up to this many rows, then it scrolls. Default: no limit. */
    maxRows?: number
    ariaLabel?: string
    /**
     * Fill the height of the parent: the text scrolls inside the box, which does not grow. For
     * a full-height editor, such as the Markdown mode of the post editor.
     */
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

/**
 * Inserts text in place of the selection and puts the caret after it. With
 * `block`, the text gets a blank line before and after it.
 */
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

/**
 * Puts the caret at the start of a line (from 0), and scrolls that line to the top of the box.
 * The outline of the post editor uses it to jump to a heading.
 */
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
