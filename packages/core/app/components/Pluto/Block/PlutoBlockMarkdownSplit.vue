<script setup lang="ts">
import type { SplitterItem } from '@nuxt/ui'
import type { PlutoMarkdownCodeEditor as CodeEditor } from '#components'
import { findBlock } from '#layers/pluto/shared/utils/blocks/tree'
import componentBlocks from '#pluto-blocks'
import PlutoBlockModeSwitch from './PlutoBlockModeSwitch.vue'
import PlutoBlockPreviewFrame from './PlutoBlockPreviewFrame.vue'
import PlutoBlockSnippetMenu from './PlutoBlockSnippetMenu.vue'

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

const frontmatter = computed<Record<string, unknown>>(() => {
  const item = form?.item.value ?? {}
  return Object.fromEntries(
    Object.entries(item).filter(([key]) => key !== 'body')
  )
})

const code = useTemplateRef<InstanceType<typeof CodeEditor>>('code')

const isDesktop = useMediaQuery('(min-width: 64rem)')
const splitSize = useCookie<number>('pluto-mdc-split', {
  default: () => 50,
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
})
const MIN = 25
const MAX = 75
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
      handle:
        'bg-(--ui-border) data-[orientation=horizontal]:w-px data-[orientation=vertical]:h-px before:absolute before:z-10 before:transition-colors before:duration-150! hover:before:bg-haze-400 hover:before:delay-300! data-[resize-handle-state=drag]:before:bg-haze-400 data-[resize-handle-state=drag]:before:delay-0! data-[orientation=horizontal]:before:inset-y-0 data-[orientation=horizontal]:before:inset-x-[-2.5px] data-[orientation=vertical]:before:inset-x-0 data-[orientation=vertical]:before:inset-y-[-2.5px]',
    }"
    data-block-canvas
    @layout="onLayout"
    @dragging="onDragging"
  >
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
              <PlutoBlockSnippetMenu :insert="insert" :disabled="disabled" />
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
