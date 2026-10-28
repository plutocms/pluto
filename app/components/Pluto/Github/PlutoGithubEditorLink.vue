<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'

// The link button of the Markdown editor toolbar. A popover holds the URL.
const props = defineProps<{
  editor: Editor
}>()

const { t } = usePlutoI18n()

const open = ref(false)
const url = ref('')
const active = ref(false)
const disabled = ref(true)

// Reads the editor state after each change. A computed must not read it.
function sync() {
  const { editor } = props
  active.value = editor.isActive('link')
  disabled.value =
    !editor.isEditable || (editor.state.selection.empty && !active.value)
  url.value = (editor.getAttributes('link').href as string | undefined) ?? ''
}

watch(
  () => props.editor,
  (editor, _previous, onCleanup) => {
    sync()
    editor.on('selectionUpdate', sync)
    editor.on('transaction', sync)
    onCleanup(() => {
      editor.off('selectionUpdate', sync)
      editor.off('transaction', sync)
    })
  },
  { immediate: true }
)

function setLink() {
  const href = url.value.trim()
  if (!href) {
    return
  }
  const empty = props.editor.state.selection.empty
  let chain = props.editor
    .chain()
    .focus()
    .extendMarkRange('link')
    .setLink({ href })
  if (empty) {
    chain = chain.insertContent({ type: 'text', text: href })
  }
  chain.run()
  open.value = false
}

function removeLink() {
  props.editor.chain().focus().extendMarkRange('link').unsetLink().run()
  url.value = ''
  open.value = false
}

function openLink() {
  if (url.value) {
    window.open(url.value, '_blank', 'noopener,noreferrer')
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    setLink()
  }
}
</script>

<template>
  <UPopover v-model:open="open" :ui="{ content: 'p-0.5' }">
    <UTooltip :text="t('pluto.github.editor.link')">
      <UButton
        :active="active"
        :disabled="disabled"
        :aria-label="t('pluto.github.editor.link')"
        icon="i-lucide-link"
        color="neutral"
        active-color="primary"
        variant="ghost"
        active-variant="soft"
        size="sm"
      />
    </UTooltip>

    <template #content>
      <UInput
        v-model="url"
        :placeholder="t('pluto.github.editor.linkPopover.placeholder')"
        name="url"
        type="url"
        variant="none"
        autofocus
        @keydown="onKeydown"
      >
        <div class="mr-0.5 flex items-center">
          <UButton
            :disabled="!url"
            :title="t('pluto.github.editor.linkPopover.apply')"
            :aria-label="t('pluto.github.editor.linkPopover.apply')"
            icon="i-lucide-corner-down-left"
            variant="ghost"
            size="sm"
            @click="setLink"
          />
          <USeparator orientation="vertical" class="mx-1 h-6" />
          <UButton
            :disabled="!url"
            :title="t('pluto.github.editor.linkPopover.open')"
            :aria-label="t('pluto.github.editor.linkPopover.open')"
            icon="i-lucide-external-link"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="openLink"
          />
          <UButton
            :disabled="!active"
            :title="t('pluto.github.editor.linkPopover.remove')"
            :aria-label="t('pluto.github.editor.linkPopover.remove')"
            icon="i-lucide-trash"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="removeLink"
          />
        </div>
      </UInput>
    </template>
  </UPopover>
</template>
