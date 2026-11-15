<script setup lang="ts">
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
    :aria-label="t('pluto.blocks.editor.blocks')"
    class="bg-pluto-panel flex min-h-0 flex-1 flex-col"
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
        {{ t('pluto.blocks.editor.blocks') }}
      </h2>
      <div class="ms-auto flex items-center gap-1">
        <UTooltip :text="t('pluto.blocks.editor.undo')" :kbds="['meta', 'Z']">
          <UButton
            :disabled="disabled || !editor.canUndo.value"
            :aria-label="t('pluto.blocks.editor.undo')"
            icon="i-lucide-undo-2"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="editor.undo()"
          />
        </UTooltip>
        <UTooltip :text="t('pluto.blocks.editor.redo')" :kbds="['meta', 'shift', 'Z']">
          <UButton
            :disabled="disabled || !editor.canRedo.value"
            :aria-label="t('pluto.blocks.editor.redo')"
            icon="i-lucide-redo-2"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="editor.redo()"
          />
        </UTooltip>
        <UButton
          :label="t('pluto.blocks.editor.add')"
          :disabled="disabled"
          :aria-label="t('pluto.blocks.editor.addBlock')"
          icon="i-lucide-plus"
          color="primary"
          variant="soft"
          size="xs"
          @click="editor.openPalette()"
        />
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
            :title="t('pluto.blocks.editor.emptyTitle')"
            :description="t('pluto.blocks.editor.emptyDescription')"
            :actions="[
              {
                label: t('pluto.blocks.editor.addBlock'),
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
