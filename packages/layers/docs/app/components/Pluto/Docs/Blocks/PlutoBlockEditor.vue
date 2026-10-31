<script setup lang="ts">
// The component layer. Only the two editor roots import it, so it stays out of the public pages.
import componentBlocks from '#pluto-docs/blocks'
// The visual block editor: the canvas of the 'canvas' form layout. The canvas
// shows the live preview of the page. The block list goes in the left panel,
// and the controls of the selected block go in the right panel (a tab of the
// form's aside). The widget keeps all the state, so the panels are slots of
// this one component tree. The value is the Markdown text of the page body. A
// block that no edit touched keeps its bytes, so opening and saving a page
// with no edit changes nothing. See the block-editor skill.
import PlutoBlockInspector from './PlutoBlockInspector.vue'
import PlutoBlockOutline from './PlutoBlockOutline.vue'
import PlutoBlockPalette from './PlutoBlockPalette.vue'
import PlutoBlockPreviewFrame from './PlutoBlockPreviewFrame.vue'

const props = defineProps<{
  modelValue: string
  disabled?: boolean
  mode: 'visual' | 'markdown'
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:mode': [mode: 'visual' | 'markdown']
}>()

const { t } = usePlutoI18n()
const form = usePlutoContentForm()
const blockSources = usePlutoBlockSources(componentBlocks)

const editor = createPlutoBlockEditor({
  source: () => props.modelValue,
  emit: (value) => emit('update:modelValue', value),
  sources: blockSources,
})
provide(plutoBlockEditorKey, editor)

// The front matter for the preview header: the item without the body and the internal `_` keys.
const frontmatter = computed<Record<string, unknown>>(() => {
  const item = form?.item.value ?? {}
  return Object.fromEntries(
    Object.entries(item).filter(
      ([key]) => key !== 'body' && !key.startsWith('_')
    )
  )
})

// A selection brings the Block tab forward (and opens the panel on a narrow screen). On a narrow
// screen the block list is a slideover. A choice in it closes the slideover, so the controls show.
const wide = useMediaQuery('(min-width: 1024px)')
watch(
  () => editor.selection.value,
  (selection) => {
    if (!selection) {
      return
    }
    if (!wide.value && selection.source === 'ui') {
      document
        .querySelector('[data-block-outline]')
        ?.closest('[role="dialog"]')
        ?.querySelector<HTMLElement>('button[data-slot="close"]')
        ?.click()
    }
    form?.openPanel('block')
  }
)

// One undo stack for the page: Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or Ctrl+Y). They act while the
// focus is in the editor (a panel or the canvas). Elsewhere (the Page tab) the browser keeps its own undo.
function onKeydown(event: KeyboardEvent) {
  if (props.disabled || !(event.ctrlKey || event.metaKey) || event.altKey) {
    return
  }
  const target = event.target
  const inside =
    target instanceof Element &&
    (target.closest('[data-pluto-block-ui]') ||
      target.closest('[data-block-canvas]'))
  const key = event.key.toLowerCase()
  if (!inside) {
    return
  }
  const row =
    target instanceof Element
      ? target.closest<HTMLElement>('[data-block-row]')?.dataset.blockRow
      : undefined
  if (key === 'z' && !event.shiftKey) {
    event.preventDefault()
    editor.undo()
  } else if ((key === 'z' && event.shiftKey) || key === 'y') {
    event.preventDefault()
    editor.redo()
  } else {
    return
  }
  // A list row that moves in the DOM loses the focus. Give it back, so the next shortcut works.
  nextTick(() => {
    if (
      row &&
      (!document.activeElement || document.activeElement === document.body)
    ) {
      document
        .querySelector<HTMLElement>(`[data-block-row="${CSS.escape(row)}"]`)
        ?.focus()
    }
  })
}

onMounted(() => document.addEventListener('keydown', onKeydown, true))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown, true))
</script>

<template>
  <div class="flex h-full min-h-0 flex-col" data-block-canvas>
    <div v-if="editor.error.value" class="p-4">
      <UAlert
        :title="t('docs.editor.parseErrorTitle')"
        :description="t('docs.editor.parseError')"
        :actions="[
          {
            label: t('docs.editor.switchToMarkdown'),
            color: 'neutral',
            variant: 'outline',
            onClick: () => emit('update:mode', 'markdown'),
          },
        ]"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
      />
    </div>

    <PlutoBlockPreviewFrame
      v-else
      :frontmatter="frontmatter"
      class="min-h-0 flex-1"
    />

    <template v-if="!editor.error.value">
      <PlutoContentCanvasPanel
        id="blocks"
        :label="t('docs.editor.blocks')"
        side="left"
        icon="i-lucide-blocks"
      >
        <PlutoBlockOutline
          :mode="mode"
          :disabled="disabled"
          @update:mode="emit('update:mode', $event)"
        />
      </PlutoContentCanvasPanel>

      <PlutoContentCanvasPanel
        id="block"
        :label="t('docs.editor.blockTab')"
        side="right"
        icon="i-lucide-square-pen"
      >
        <PlutoBlockInspector :disabled="disabled" />
      </PlutoContentCanvasPanel>

      <PlutoBlockPalette />
    </template>
  </div>
</template>
