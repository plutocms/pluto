<script setup lang="ts">
import type { Editor as CoreEditor } from '@tiptap/core'
import type { Editor } from '@tiptap/vue-3'
import type { PlutoMedia } from '../../../../shared/types/media'
import { NodeSelection } from '@tiptap/pm/state'
import PlutoEditorBubble from './PlutoEditorBubble.vue'

const props = defineProps<{
  editor: Editor
}>()

const { t } = usePlutoI18n()
const media = usePlutoMedia()

const alt = ref('')
const src = ref('')
const pickerOpen = ref(false)

function selectedImage(editor: CoreEditor) {
  const { selection } = editor.state
  return selection instanceof NodeSelection &&
    selection.node.type.name === 'image'
    ? {
        pos: selection.from,
        src: String(selection.node.attrs.src ?? ''),
        alt: String(selection.node.attrs.alt ?? ''),
      }
    : null
}

function shouldShow({ editor }: { editor: CoreEditor }) {
  return editor.isEditable && selectedImage(editor) !== null
}

let current: { pos: number; src: string; alt: string } | null = null
function sync() {
  const next = selectedImage(props.editor)
  if (
    next &&
    (next.pos !== current?.pos ||
      next.src !== current.src ||
      next.alt !== current.alt)
  ) {
    alt.value = next.alt
    src.value = next.src
  }
  current = next
}

watch(
  () => props.editor,
  (editor, _previous, onCleanup) => {
    sync()
    editor.on('selectionUpdate', sync)
    onCleanup(() => editor.off('selectionUpdate', sync))
  },
  { immediate: true }
)

function setImage(attrs: { src?: string; alt?: string }, focus: boolean) {
  if (!current) {
    return
  }
  const { pos } = current
  const node = props.editor.state.doc.nodeAt(pos)
  if (!node) {
    return
  }
  const tr = props.editor.state.tr.setNodeMarkup(pos, undefined, {
    ...node.attrs,
    ...attrs,
  })
  tr.setSelection(NodeSelection.create(tr.doc, pos))
  props.editor.view.dispatch(tr)
  if (focus) {
    props.editor.commands.focus()
  }
}

function applyAlt(focus: boolean) {
  const value = alt.value.trim()
  if (current && value !== current.alt) {
    setImage({ alt: value || undefined }, focus)
  } else if (focus) {
    props.editor.commands.focus()
  }
}

function replace(chosen: PlutoMedia[]) {
  const [image] = chosen
  if (!image || !current) {
    return
  }
  setImage({ src: image.url, alt: current.alt || image.alt || undefined }, true)
}

function backToText() {
  props.editor.commands.focus()
}

function remove() {
  props.editor.chain().focus().deleteSelection().run()
}
</script>

<template>
  <PlutoEditorBubble
    :editor="editor"
    :should-show="shouldShow"
    plugin-key="plutoImageMenu"
  >
    <div class="flex w-96 max-w-[calc(100vw-3rem)] flex-col gap-2">
      <UInput
        v-model="alt"
        :aria-label="t('pluto.github.editor.imagePopover.alt')"
        :placeholder="t('pluto.github.editor.imagePopover.altPlaceholder')"
        icon="i-lucide-text"
        size="sm"
        autocomplete="off"
        @keydown.enter.prevent="applyAlt(true)"
        @keydown.esc.prevent="backToText"
        @change="applyAlt(false)"
      />
      <div class="flex items-center justify-between gap-1">
        <UButton
          v-if="media.enabled"
          :label="t('pluto.github.editor.imagePopover.replace')"
          icon="i-lucide-image-up"
          color="neutral"
          variant="ghost"
          size="xs"
          @click="pickerOpen = true"
        />
        <UButton
          :label="t('pluto.github.editor.imagePopover.open')"
          :to="src || undefined"
          :disabled="!src"
          trailing-icon="i-lucide-arrow-up-right"
          color="neutral"
          variant="ghost"
          size="xs"
          target="_blank"
        />
        <UButton
          :label="t('pluto.github.editor.imagePopover.remove')"
          icon="i-lucide-trash"
          color="error"
          variant="ghost"
          size="xs"
          @click="remove"
        />
      </div>
    </div>

    <PlutoMediaPicker
      v-if="media.enabled"
      v-model:open="pickerOpen"
      :accept="['image/*']"
      @select="replace"
    />
  </PlutoEditorBubble>
</template>
