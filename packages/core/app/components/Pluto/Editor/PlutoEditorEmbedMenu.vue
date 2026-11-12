<script setup lang="ts">
// The popover of a video block (`plutoEmbed`) of the Visual editor: it shows under the block while
// the block is selected (a click on it). The address can change: Enter, or leaving the field,
// applies it when a video player of the site matches it (else a message, and the block stays).
// Open the video in a new tab, or remove the block.
import type { Editor as CoreEditor } from '@tiptap/core'
import type { Editor } from '@tiptap/vue-3'
import { NodeSelection } from '@tiptap/pm/state'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import { resolveEmbed } from '#layers/pluto/shared/utils/embed'

const props = defineProps<{
  editor: Editor
}>()

const { t } = usePlutoI18n()
const registry = usePlutoRegistry()

const url = ref('')
const invalid = ref(false)

/** The selected video block: its position and its address, or null. */
function selectedEmbed(editor: CoreEditor) {
  const { selection } = editor.state
  return selection instanceof NodeSelection &&
    selection.node.type.name === 'plutoEmbed'
    ? { pos: selection.from, url: String(selection.node.attrs.url ?? '') }
    : null
}

function shouldShow({ editor }: { editor: CoreEditor }) {
  return editor.isEditable && selectedEmbed(editor) !== null
}

let current: { pos: number; url: string } | null = null
function sync() {
  const next = selectedEmbed(props.editor)
  if (next && (next.pos !== current?.pos || next.url !== current.url)) {
    url.value = next.url
    invalid.value = false
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

/** Applies the address. `focus`: the editor gets the focus back, with the block selected. */
function apply(focus: boolean) {
  if (!current) {
    return
  }
  const href = url.value.trim()
  if (href === current.url) {
    invalid.value = false
    if (focus) {
      props.editor.commands.focus()
    }
    return
  }
  if (!resolveEmbed(registry.embedProviders.list.value, href)) {
    invalid.value = true
    return
  }
  invalid.value = false
  const { pos } = current
  const node = props.editor.state.doc.nodeAt(pos)
  if (!node) {
    return
  }
  // A new address is written alone on its line (no source text to keep).
  const tr = props.editor.state.tr.setNodeMarkup(pos, undefined, {
    ...node.attrs,
    url: href,
    source: undefined,
  })
  tr.setSelection(NodeSelection.create(tr.doc, pos))
  props.editor.view.dispatch(tr)
  current = { pos, url: href }
  if (focus) {
    props.editor.commands.focus()
  }
}

// A click on the video gives the focus to the address, with the text selected, so a paste or a new
// address replaces it. A block selected another way (the keys) keeps the focus in the text. Escape
// in the field goes back to the text.
const panel = useTemplateRef<HTMLElement>('panel')
let clickedAt = 0
function onPointerDown(event: PointerEvent) {
  if ((event.target as Element | null)?.closest('.pluto-embed-node')) {
    clickedAt = performance.now()
  }
}

watch(
  () => props.editor,
  (editor, _previous, onCleanup) => {
    const dom = editor.isDestroyed ? null : editor.view.dom
    dom?.addEventListener('pointerdown', onPointerDown)
    onCleanup(() => dom?.removeEventListener('pointerdown', onPointerDown))
  },
  { immediate: true }
)

function onShow() {
  if (performance.now() - clickedAt > 1000) {
    return
  }
  requestAnimationFrame(() => {
    const input = panel.value?.querySelector('input')
    input?.focus()
    input?.select()
  })
}

function selectAll(event: FocusEvent) {
  ;(event.target as HTMLInputElement | null)?.select()
}

function backToText() {
  props.editor.commands.focus()
}

function remove() {
  props.editor.chain().focus().deleteSelection().run()
}
</script>

<template>
  <BubbleMenu
    :editor="editor"
    :should-show="shouldShow"
    :options="{ placement: 'bottom-start', offset: 8, onShow }"
    plugin-key="plutoEmbedMenu"
  >
    <div
      ref="panel"
      class="bg-default ring-default flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-lg p-2 shadow-lg ring dark:bg-neutral-950"
    >
      <UInput
        v-model="url"
        :aria-label="t('pluto.github.editor.embedPopover.url')"
        :placeholder="t('pluto.github.editor.embedPopover.url')"
        :color="invalid ? 'error' : undefined"
        :highlight="invalid"
        icon="i-lucide-play"
        size="sm"
        autocomplete="off"
        spellcheck="false"
        @keydown.enter.prevent="apply(true)"
        @keydown.esc.prevent="backToText"
        @focus="selectAll"
        @change="apply(false)"
      />
      <p v-if="invalid" class="text-error text-xs">
        {{ t('pluto.github.editor.embedPopover.invalid') }}
      </p>
      <div class="flex items-center justify-end gap-1">
        <UButton
          :label="t('pluto.github.editor.embedPopover.open')"
          :to="url || undefined"
          trailing-icon="i-lucide-arrow-up-right"
          color="neutral"
          variant="ghost"
          size="xs"
          target="_blank"
        />
        <UButton
          :label="t('pluto.github.editor.embedPopover.remove')"
          icon="i-lucide-trash"
          color="error"
          variant="ghost"
          size="xs"
          @click="remove"
        />
      </div>
    </div>
  </BubbleMenu>
</template>
