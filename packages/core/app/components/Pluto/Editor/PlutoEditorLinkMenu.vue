<script setup lang="ts">
import type { Editor as CoreEditor } from '@tiptap/core'
import type { Editor } from '@tiptap/vue-3'
import PlutoEditorBubble from './PlutoEditorBubble.vue'

const props = defineProps<{
  editor: Editor
}>()

const { t } = usePlutoI18n()

const url = ref('')
const text = ref('')
const blank = ref(false)
let link: {
  from: number
  to: number
  href: string
  text: string
  blank: boolean
} | null = null

function linkAtCaret(editor: CoreEditor) {
  const { state } = editor
  const type = state.schema.marks.link
  if (!type || !state.selection.empty) {
    return null
  }
  const { $from } = state.selection
  const parent = $from.parent
  let found = parent.childAfter($from.parentOffset)
  let mark = found.node?.marks.find((item) => item.type === type)
  if (!mark) {
    found = parent.childBefore($from.parentOffset)
    mark = found.node?.marks.find((item) => item.type === type)
  }
  if (!mark) {
    return null
  }
  let first = found.index
  let last = found.index
  while (first > 0 && mark.isInSet(parent.child(first - 1).marks)) {
    first--
  }
  while (
    last < parent.childCount - 1 &&
    mark.isInSet(parent.child(last + 1).marks)
  ) {
    last++
  }
  let offset = 0
  for (let index = 0; index < first; index++) {
    offset += parent.child(index).nodeSize
  }
  const from = $from.start() + offset
  let to = from
  for (let index = first; index <= last; index++) {
    to += parent.child(index).nodeSize
  }
  return {
    from,
    to,
    href: String(mark.attrs.href ?? ''),
    text: state.doc.textBetween(from, to),
    blank: mark.attrs.target === '_blank',
  }
}

function shouldShow({ editor }: { editor: CoreEditor }) {
  return editor.isEditable && linkAtCaret(editor) !== null
}

function sync() {
  const next = linkAtCaret(props.editor)
  if (
    next &&
    (next.from !== link?.from ||
      next.to !== link?.to ||
      next.href !== link.href)
  ) {
    url.value = next.href
    text.value = next.text
  }
  blank.value = next?.blank ?? false
  link = next
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

function apply(focus: boolean) {
  if (!link) {
    return
  }
  const href = url.value.trim()
  const label = text.value || href
  if (!href) {
    return
  }
  if (href === link.href && label === link.text) {
    if (focus) {
      props.editor.chain().focus().setTextSelection(link.to).run()
    }
    return
  }
  const type = props.editor.schema.marks.link!
  const attrs = props.editor.state.doc
    .resolve(link.from + 1)
    .marks()
    .find((item) => item.type === type)?.attrs
  const chain = props.editor.chain().insertContentAt(
    { from: link.from, to: link.to },
    {
      type: 'text',
      text: label,
      marks: [{ type: 'link', attrs: { ...attrs, href } }],
    }
  )
  if (focus) {
    chain.focus().setTextSelection(link.from + label.length)
  }
  chain.run()
  link = {
    ...link,
    to: link.from + label.length,
    href,
    text: label,
  }
}

function setBlank(value: boolean | 'indeterminate') {
  if (!link) {
    return
  }
  const target = value === true ? '_blank' : null
  const caret = props.editor.state.selection.head
  props.editor
    .chain()
    .setTextSelection({ from: link.from, to: link.to })
    .updateAttributes('link', { target })
    .setTextSelection(caret)
    .run()
  link = { ...link, blank: target !== null }
  blank.value = link.blank
}

function backToText() {
  if (link) {
    props.editor.chain().focus().setTextSelection(link.to).run()
  }
}

function remove() {
  if (!link) {
    return
  }
  props.editor
    .chain()
    .focus()
    .setTextSelection({ from: link.from, to: link.to })
    .unsetLink()
    .setTextSelection(link.to)
    .run()
}
</script>

<template>
  <PlutoEditorBubble
    :editor="editor"
    :should-show="shouldShow"
    plugin-key="plutoLinkMenu"
  >
    <div class="flex w-80 max-w-[calc(100vw-3rem)] flex-col gap-2">
      <UInput
        v-model="url"
        :aria-label="t('pluto.github.editor.linkPopover.url')"
        :placeholder="t('pluto.github.editor.linkPopover.placeholder')"
        icon="i-lucide-link"
        size="sm"
        autocomplete="off"
        spellcheck="false"
        @keydown.enter.prevent="apply(true)"
        @keydown.esc.prevent="backToText"
        @change="apply(false)"
      />
      <UInput
        v-model="text"
        :aria-label="t('pluto.github.editor.linkPopover.text')"
        :placeholder="t('pluto.github.editor.linkPopover.textPlaceholder')"
        icon="i-lucide-type"
        size="sm"
        autocomplete="off"
        @keydown.enter.prevent="apply(true)"
        @keydown.esc.prevent="backToText"
        @change="apply(false)"
      />
      <UCheckbox
        :model-value="blank"
        :label="t('pluto.github.editor.linkPopover.newTab')"
        size="sm"
        class="px-1 py-0.5"
        @update:model-value="setBlank"
      />

      <div class="flex items-center justify-between gap-1">
        <UButton
          :label="t('pluto.github.editor.linkPopover.open')"
          :to="url || undefined"
          :disabled="!url"
          trailing-icon="i-lucide-arrow-up-right"
          color="neutral"
          variant="ghost"
          size="xs"
          target="_blank"
        />
        <UButton
          :label="t('pluto.github.editor.linkPopover.remove')"
          icon="i-lucide-unlink"
          color="error"
          variant="ghost"
          size="xs"
          @click="remove"
        />
      </div>
    </div>
  </PlutoEditorBubble>
</template>
