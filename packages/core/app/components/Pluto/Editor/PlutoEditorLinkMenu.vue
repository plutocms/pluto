<script setup lang="ts">
// The link popover of the Visual editor: it shows under a link while the caret is in it (a click on
// a link puts the caret there). The address and the text of the link can change: Enter, or leaving
// the field, applies them. The box makes the link open in a new tab on the site
// (`{target="_blank"}`, see PlutoLink). Open the link in a new tab, or remove it (the text stays).
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
// The link of the popover: its range in the document, and its address and text as they were.
let link: {
  from: number
  to: number
  href: string
  text: string
  blank: boolean
} | null = null

/** The link around the caret, or null. */
function linkAtCaret(editor: CoreEditor) {
  const { state } = editor
  const type = state.schema.marks.link
  if (!type || !state.selection.empty) {
    return null
  }
  // The text node at the caret (after it, else before it) with a link, then its neighbors with the
  // same link.
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

// The fields follow the link of the caret. The author types in the fields, not in the text, so a
// new link only comes with a new caret.
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

/** Applies the fields to the link. `focus`: the caret goes back to the text, after the link. */
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

/** Opens the link in a new tab on the site, or not. The caret stays. */
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

// The popover never takes the focus: a click in a link puts the caret there, to edit the text.
// Escape in a field goes back to the text.
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

      <div class="flex items-center justify-end gap-1">
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
