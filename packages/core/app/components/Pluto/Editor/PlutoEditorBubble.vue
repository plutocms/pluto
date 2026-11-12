<script setup lang="ts">
// A popover of the Visual editor on a link, a video or an image (Tiptap `BubbleMenu`): the panel of
// the admin popovers, with an arrow that points at what it edits. It opens under its target
// (`bottom-start`, so a narrow column does not scroll sideways), above when there is no room.
// Tiptap places the panel; this component places the arrow after each move (`onUpdate`): on the
// side of the target, at its start (a block) or at the caret (a link). See the git-cms skill.
import type { Editor as CoreEditor } from '@tiptap/core'
import type { Editor } from '@tiptap/vue-3'
import { NodeSelection } from '@tiptap/pm/state'
import { BubbleMenu } from '@tiptap/vue-3/menus'

const props = defineProps<{
  editor: Editor
  pluginKey: string
  shouldShow: (props: { editor: CoreEditor }) => boolean
}>()

const emit = defineEmits<{
  show: []
}>()

const panel = useTemplateRef<HTMLElement>('panel')
const arrow = ref<{ side: 'top' | 'bottom'; left: number }>({
  side: 'top',
  left: 16,
})

/** The box of the target: the selected block, or the caret. */
function targetRect(): DOMRect | null {
  const { view, state } = props.editor
  const { selection } = state
  if (selection instanceof NodeSelection) {
    const dom = view.nodeDOM(selection.from)
    return dom instanceof HTMLElement ? dom.getBoundingClientRect() : null
  }
  const caret = view.coordsAtPos(selection.from)
  return new DOMRect(caret.left, caret.top, 0, caret.bottom - caret.top)
}

function placeArrow() {
  const box = panel.value?.getBoundingClientRect()
  const target = targetRect()
  if (!box || !target) {
    return
  }
  const point =
    target.width > 0
      ? target.left + Math.min(24, target.width / 2)
      : target.left
  arrow.value = {
    side: box.top >= target.top ? 'top' : 'bottom',
    left: Math.min(Math.max(point - box.left, 14), box.width - 14),
  }
}

const options = {
  placement: 'bottom-start' as const,
  offset: 10,
  onShow: () => {
    emit('show')
    requestAnimationFrame(placeArrow)
  },
  onUpdate: placeArrow,
}
</script>

<template>
  <BubbleMenu
    :editor="editor"
    :should-show="shouldShow"
    :plugin-key="pluginKey"
    :options="options"
  >
    <div
      ref="panel"
      class="bg-default ring-default relative rounded-lg p-2 shadow-lg ring dark:bg-neutral-950"
    >
      <span
        :class="
          arrow.side === 'top'
            ? '-top-1.25 border-s border-t'
            : '-bottom-1.25 border-e border-b'
        "
        :style="{ left: `${arrow.left}px` }"
        class="bg-default border-default absolute size-2.5 -translate-x-1/2 rotate-45 dark:bg-neutral-950"
        aria-hidden="true"
      />
      <slot />
    </div>
  </BubbleMenu>
</template>
