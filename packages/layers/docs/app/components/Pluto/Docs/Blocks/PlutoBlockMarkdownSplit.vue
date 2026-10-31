<script setup lang="ts">
// The Markdown mode of the `mdc` widget in a canvas form: the Markdown at the
// left and the live preview at the right, side by side (stacked on a narrow
// screen). The handle between them resizes them, and a cookie keeps the size.
// The preview is the frame of the visual editor, so it renders with the site
// parser. A click on a block in the preview selects the first line of that
// block in the Markdown and scrolls to it. The Markdown editor is
// PlutoMarkdownCodeEditor of core (CodeMirror). The Markdown is the only editor
// here: the block model only feeds the preview and never writes.
import type { SplitterItem } from '@nuxt/ui'
import type { PlutoMarkdownCodeEditor as CodeEditor } from '#components'
// The component layer. Only the two editor roots import it, so it stays out of the public pages.
import componentBlocks from '#pluto-docs/blocks'
import { findBlock } from '../../../../../shared/utils/blocks/tree'
import PlutoMdcInsertMenu from '../PlutoMdcInsertMenu.vue'
import PlutoBlockModeSwitch from './PlutoBlockModeSwitch.vue'
import PlutoBlockPreviewFrame from './PlutoBlockPreviewFrame.vue'

const props = defineProps<{
  modelValue: string
  disabled?: boolean
  mode: 'visual' | 'markdown'
  placeholder?: string
  label?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:mode': [mode: 'visual' | 'markdown']
}>()

const form = usePlutoContentForm()
const blockSources = usePlutoBlockSources(componentBlocks)

const editor = createPlutoBlockEditor({
  source: () => props.modelValue,
  emit: () => {},
  sources: blockSources,
})
provide(plutoBlockEditorKey, editor)

// The front matter for the preview header: the item without the body.
const frontmatter = computed<Record<string, unknown>>(() => {
  const item = form?.item.value ?? {}
  return Object.fromEntries(
    Object.entries(item).filter(([key]) => key !== 'body')
  )
})

const code = useTemplateRef<InstanceType<typeof CodeEditor>>('code')

// --- The split ---------------------------------------------------------------------

const isDesktop = useMediaQuery('(min-width: 64rem)')
// The size of the Markdown pane, in percent of the row (desktop) or of the column (narrow).
const splitSize = useCookie<number>('pluto-mdc-split', {
  default: () => 50,
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
})
const MIN = 25
const MAX = 75
// Read once: a reactive `defaultSize` would rebuild the panels on each save of the size.
const initialSize = Math.min(MAX, Math.max(MIN, Number(splitSize.value) || 50))
const items: SplitterItem[] = [
  {
    id: 'pluto-mdc-source',
    slot: 'source',
    defaultSize: initialSize,
    minSize: MIN,
    maxSize: MAX,
  },
  { id: 'pluto-mdc-preview', slot: 'preview' },
]

// The pointer over the iframe goes to the frame, and the drag stops. So the preview takes no
// pointer events while the handle moves. The size is saved when the drag ends.
const dragging = ref(false)
let lastLayout: number[] = []
function onLayout(sizes: number[]) {
  lastLayout = sizes
}
function onDragging(_index: number, value: boolean) {
  dragging.value = value
  if (!value && lastLayout[0]) {
    splitSize.value = Math.round(lastLayout[0])
  }
}

// A click on a block in the preview: go to that block in the Markdown.
watch(
  () => editor.selection.value,
  (selection) => {
    if (selection?.source !== 'preview') {
      return
    }
    const original = findBlock(editor.doc.value, selection.id)?.block.original
    if (original) {
      code.value?.reveal(original.start, original.end)
    }
  }
)
</script>

<template>
  <USplitter
    id="pluto-mdc-split"
    :items="items"
    :orientation="isDesktop ? 'horizontal' : 'vertical'"
    :ui="{
      root: 'h-full min-h-0',
      // A 1px line. A `::before` 2.5px wider on each side is the 6px grab area,
      // and the 6px haze-400 bar: it fades in after 300ms of hover, and shows at
      // once while dragging. In both directions. The `!` keeps the duration and
      // the delay against the no-transition rule of the admin (core pluto-layer.css).
      handle:
        'bg-(--ui-border) data-[orientation=horizontal]:w-px data-[orientation=vertical]:h-px before:absolute before:z-10 before:transition-colors before:duration-150! hover:before:bg-haze-400 hover:before:delay-300! data-[resize-handle-state=drag]:before:bg-haze-400 data-[resize-handle-state=drag]:before:delay-0! data-[orientation=horizontal]:before:inset-y-0 data-[orientation=horizontal]:before:inset-x-[-2.5px] data-[orientation=vertical]:before:inset-x-0 data-[orientation=vertical]:before:inset-y-[-2.5px]',
    }"
    data-block-canvas
    @layout="onLayout"
    @dragging="onDragging"
  >
    <!-- The source pane: the code editor, and the mode switch in a fixed footer, as in the Visual mode. -->
    <template #source>
      <div class="flex size-full min-h-0 flex-col">
        <div class="min-h-0 flex-1 p-4">
          <PlutoMarkdownCodeEditor
            ref="code"
            :model-value="modelValue"
            :disabled="disabled"
            :placeholder="placeholder"
            :aria-label="label"
            fill
            @update:model-value="emit('update:modelValue', $event)"
          >
            <template #toolbar="{ insert }">
              <PlutoMdcInsertMenu :insert="insert" :disabled="disabled" />
            </template>
          </PlutoMarkdownCodeEditor>
        </div>
        <div
          class="flex shrink-0 items-center justify-between gap-2 border-t border-default px-3 py-2"
        >
          <PlutoBlockModeSwitch
            :mode="mode"
            :disabled="disabled"
            @update:mode="emit('update:mode', $event)"
          />
        </div>
      </div>
    </template>

    <template #preview>
      <PlutoBlockPreviewFrame
        :frontmatter="frontmatter"
        :class="{ 'pointer-events-none': dragging }"
        class="size-full"
      />
    </template>
  </USplitter>
</template>
