<script setup lang="ts">
import type { EditorToolbarItem } from '@nuxt/ui'

// The `richtext` widget of the standalone CMS. It edits a Markdown string with
// the Nuxt UI editor (Tiptap). The model value is the Markdown text, so the
// adapter stores the body as it is. The CMS client plugin registers this
// widget in CMS mode only, and loads it with `defineAsyncComponent`, so
// Tiptap loads on the edit page only.
//
// The editor knows the CommonMark parts and strikethrough. It has no node for
// a table, a task list or raw HTML. A post that uses them keeps the text, but
// the editor can lose the markup when it saves. See the github-cms skill.
const props = defineProps<{
  field: PlutoTextField
  modelValue: unknown
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t } = usePlutoI18n()

const value = computed(() => (typeof props.modelValue === 'string' ? props.modelValue : ''))

const placeholder = computed(() => props.field.placeholder ?? t('pluto.cms.editor.placeholder'))

// The toolbar items use the built-in handlers of the editor. Labels and
// tooltips come from the `pluto.cms.editor.*` keys. The link button is a slot.
const items = computed<EditorToolbarItem[][]>(() => [
  [
    { kind: 'undo', icon: 'i-lucide-undo', tooltip: { text: t('pluto.cms.editor.undo') } },
    { kind: 'redo', icon: 'i-lucide-redo', tooltip: { text: t('pluto.cms.editor.redo') } },
  ],
  [
    {
      icon: 'i-lucide-heading',
      tooltip: { text: t('pluto.cms.editor.headings') },
      content: { align: 'start' },
      items: ([1, 2, 3, 4] as const).map((level) => ({
        kind: 'heading' as const,
        level,
        icon: `i-lucide-heading-${level}`,
        label: t(`pluto.cms.editor.heading${level}`),
      })),
    },
    {
      icon: 'i-lucide-list',
      tooltip: { text: t('pluto.cms.editor.lists') },
      content: { align: 'start' },
      items: [
        { kind: 'bulletList', icon: 'i-lucide-list', label: t('pluto.cms.editor.bulletList') },
        { kind: 'orderedList', icon: 'i-lucide-list-ordered', label: t('pluto.cms.editor.orderedList') },
      ],
    },
    { kind: 'blockquote', icon: 'i-lucide-text-quote', tooltip: { text: t('pluto.cms.editor.blockquote') } },
    { kind: 'codeBlock', icon: 'i-lucide-square-code', tooltip: { text: t('pluto.cms.editor.codeBlock') } },
  ],
  [
    { kind: 'mark', mark: 'bold', icon: 'i-lucide-bold', tooltip: { text: t('pluto.cms.editor.bold') } },
    { kind: 'mark', mark: 'italic', icon: 'i-lucide-italic', tooltip: { text: t('pluto.cms.editor.italic') } },
    { kind: 'mark', mark: 'strike', icon: 'i-lucide-strikethrough', tooltip: { text: t('pluto.cms.editor.strike') } },
    { kind: 'mark', mark: 'code', icon: 'i-lucide-code', tooltip: { text: t('pluto.cms.editor.code') } },
    { slot: 'link', icon: 'i-lucide-link' },
  ],
])
</script>

<template>
  <UFormField :label="field.label" :description="field.description" :required="field.required">
    <!-- The editor root is a bordered box. The editable area has a minimum
         height, so a click anywhere in the box puts the cursor in the text. -->
    <UEditor
      v-slot="{ editor }"
      :model-value="value"
      :editable="!disabled"
      :placeholder="placeholder"
      :image="false"
      :mention="false"
      :ui="{
        root: 'w-full',
        content: 'min-h-96 cursor-text',
        base: 'min-h-96 px-4 py-3 sm:px-4',
      }"
      content-type="markdown"
      class="bg-default border-default w-full rounded-md border"
      @update:model-value="emit('update:modelValue', $event as string)"
    >
      <UEditorToolbar
        :editor="editor"
        :items="items"
        :aria-label="t('pluto.cms.editor.toolbar')"
        class="border-default bg-default sticky top-0 z-10 overflow-x-auto rounded-t-md border-b px-2 py-1.5"
      >
        <template #link>
          <PlutoCmsEditorLink :editor="editor" />
        </template>
      </UEditorToolbar>
    </UEditor>
  </UFormField>
</template>
