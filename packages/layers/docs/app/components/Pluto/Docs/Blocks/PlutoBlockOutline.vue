<script setup lang="ts">
// The left panel of the editor: the blocks of the page as a list. A header
// with Undo, Redo and Add. The list has the drag handle, the block menu, and
// the blocks inside a container. The mode switch (Visual or Markdown) sits at
// the bottom. The list scrolls in a Reka UI scroll area, with a thin scrollbar
// that shows on hover. The panel is white in light mode and #0b0b0b in dark.
import {
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from 'reka-ui'
import PlutoBlockModeSwitch from './PlutoBlockModeSwitch.vue'
import PlutoBlockOutlineList from './PlutoBlockOutlineList.vue'

defineProps<{
  mode: 'visual' | 'markdown'
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:mode': [mode: 'visual' | 'markdown']
}>()

const editor = usePlutoBlockEditor()
const { t } = usePlutoI18n()

// A block selected in the preview: scroll the list to its row. The editor opens the collapsed
// parents first, so the watch runs after the render (`flush: 'post'`).
watch(
  () => editor.selection.value,
  (selection) => {
    if (selection?.source !== 'preview') {
      return
    }
    document
      .querySelector<HTMLElement>(
        `[data-block-row="${CSS.escape(selection.id)}"]`
      )
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  },
  { flush: 'post' }
)
</script>

<template>
  <div
    :aria-label="t('docs.editor.blocks')"
    class="flex min-h-0 flex-1 flex-col bg-white dark:bg-[#0b0b0b]"
    role="region"
    data-block-outline
    data-pluto-block-ui
  >
    <div
      class="flex h-12 shrink-0 items-center gap-1 border-b border-default px-3"
    >
      <h2
        class="min-w-0 truncate text-sm font-semibold text-highlighted max-lg:hidden"
      >
        {{ t('docs.editor.blocks') }}
      </h2>
      <div class="ms-auto flex items-center gap-1">
        <UTooltip :text="t('docs.editor.undo')" :kbds="['meta', 'Z']">
          <UButton
            :disabled="disabled || !editor.canUndo.value"
            :aria-label="t('docs.editor.undo')"
            icon="i-lucide-undo-2"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="editor.undo()"
          />
        </UTooltip>
        <UTooltip :text="t('docs.editor.redo')" :kbds="['meta', 'shift', 'Z']">
          <UButton
            :disabled="disabled || !editor.canRedo.value"
            :aria-label="t('docs.editor.redo')"
            icon="i-lucide-redo-2"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="editor.redo()"
          />
        </UTooltip>
        <UButton
          :label="t('docs.editor.add')"
          :disabled="disabled"
          :aria-label="t('docs.editor.addBlock')"
          icon="i-lucide-plus"
          color="primary"
          variant="soft"
          size="xs"
          @click="editor.openPalette()"
        />
        <!-- Hides this panel (desktop). The core toolbar shows the toggle to open it again. -->
        <PlutoViewLeftCollapse />
      </div>
    </div>

    <ScrollAreaRoot
      type="hover"
      class="relative min-h-0 flex-1 overflow-hidden"
    >
      <ScrollAreaViewport class="size-full">
        <div class="p-2">
          <PlutoBlockOutlineList
            v-if="editor.doc.value.blocks.length"
            :blocks="editor.doc.value.blocks"
          />
          <UEmpty
            v-else
            :title="t('docs.editor.emptyTitle')"
            :description="t('docs.editor.emptyDescription')"
            :actions="[
              {
                label: t('docs.editor.addBlock'),
                icon: 'i-lucide-plus',
                onClick: () => editor.openPalette(),
              },
            ]"
            icon="i-lucide-blocks"
            variant="naked"
          />
        </div>
      </ScrollAreaViewport>
      <ScrollAreaScrollbar
        orientation="vertical"
        class="flex w-2.5 touch-none p-0.5 select-none"
      >
        <ScrollAreaThumb
          class="relative flex-1 rounded-full bg-(--ui-border-accented) hover:bg-(--ui-text-dimmed)"
        />
      </ScrollAreaScrollbar>
    </ScrollAreaRoot>

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
