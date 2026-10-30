<script setup lang="ts">
import PlutoMarkdownSource from './PlutoMarkdownSource.vue'

// The `richtext` widget of the standalone CMS. It edits a Markdown string with
// the Nuxt UI editor (Tiptap). The model value is the Markdown text, so the
// adapter stores the body as it is. The CMS client plugin registers this
// widget in CMS mode only, and loads it with `defineAsyncComponent`, so
// Tiptap loads on the edit page only.
//
// The visual editor knows the CommonMark parts and strikethrough. It has no
// node for MDC, a table, a task list or raw HTML, and it can lose that markup
// when it saves. So the widget has a Source mode (`PlutoMarkdownSource`). The
// `editor` option of the field picks the first mode: `auto` (default) opens
// Source when the text has such syntax. Visual is off while the text has it.
// See the github-cms skill.
const props = defineProps<{
  field: PlutoTextField
  modelValue: unknown
  disabled?: boolean
  /**
   * The post editor (`post-canvas`) shows this widget as its Visual mode. It fills the compose
   * panel: no label, no mode switch (the post editor has its own), a full-height box that
   * scrolls its own text, like the Markdown mode. No padding: the post editor sets the space
   * around it.
   */
  canvas?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t } = usePlutoI18n()

const value = computed(() =>
  typeof props.modelValue === 'string' ? props.modelValue : ''
)

// The Markdown that the visual editor cannot keep. It follows the text, so
// Visual turns on again when the author removes that syntax in Source.
const unsafe = computed(() => findUnsafeMarkdown(value.value))
const visualBlocked = computed(() => unsafe.value.length > 0)

const mode = ref<'visual' | 'source'>(
  pickMarkdownEditorMode(props.field.editor, value.value)
)

function setMode(next: 'visual' | 'source') {
  if (next === 'visual' && visualBlocked.value) {
    return
  }
  mode.value = next
}

const placeholder = computed(
  () => props.field.placeholder ?? t('pluto.github.editor.placeholder')
)

// In the canvas, the post editor owns the label and the Markdown mode.
const UFormField = resolveComponent('UFormField')
const frame = computed(() =>
  props.canvas
    ? {
        is: 'div',
        attrs: { class: 'flex h-full min-h-0 flex-col' },
      }
    : {
        is: UFormField,
        attrs: {
          label: props.field.label,
          description: props.field.description,
          required: props.field.required,
        },
      }
)

// The toolbar items are shared: `usePlutoMarkdownToolbar`. The link and image
// buttons are slots. The image button shows when the app has a media library.
const items = usePlutoMarkdownToolbar({
  link: true,
  image: usePlutoMedia().enabled,
})
</script>

<template>
  <component :is="frame.is" v-bind="frame.attrs">
    <div v-if="!canvas" class="mb-2 flex justify-end">
      <div
        :aria-label="t('pluto.github.editor.mode')"
        class="flex gap-1"
        role="group"
      >
        <UTooltip
          :text="t('pluto.github.editor.unsafe')"
          :disabled="!visualBlocked"
          :content="{ side: 'top' }"
        >
          <!-- A disabled button gets no pointer events, so the span carries the tooltip. -->
          <span class="inline-flex">
            <UButton
              :variant="mode === 'visual' ? 'solid' : 'outline'"
              :aria-pressed="mode === 'visual'"
              :disabled="visualBlocked || disabled"
              :label="t('pluto.github.editor.visual')"
              size="xs"
              color="neutral"
              icon="i-lucide-pen-line"
              @click="setMode('visual')"
            />
          </span>
        </UTooltip>
        <UButton
          :variant="mode === 'source' ? 'solid' : 'outline'"
          :aria-pressed="mode === 'source'"
          :disabled="disabled"
          :label="t('pluto.github.editor.source')"
          size="xs"
          color="neutral"
          icon="i-lucide-file-code"
          @click="setMode('source')"
        />
      </div>
    </div>

    <PlutoMarkdownSource
      v-if="mode === 'source' && !canvas"
      :model-value="value"
      :disabled="disabled"
      :placeholder="placeholder"
      :aria-label="field.label"
      @update:model-value="emit('update:modelValue', $event)"
    />

    <!-- The editor root is a bordered box. The editable area has a minimum
         height, so a click anywhere in the box puts the cursor in the text. -->
    <UEditor
      v-else
      v-slot="{ editor }"
      :model-value="value"
      :editable="!disabled"
      :placeholder="placeholder"
      :image="true"
      :mention="false"
      :ui="
        canvas
          ? {
              root: 'flex min-h-0 w-full flex-1 flex-col',
              content: 'min-h-0 flex-1 cursor-text overflow-y-auto',
              base: 'min-h-full px-4 py-3 sm:px-4',
            }
          : {
              root: 'w-full',
              content: 'min-h-96 cursor-text',
              base: 'min-h-96 px-4 py-3 sm:px-4',
            }
      "
      content-type="markdown"
      class="border-default bg-default w-full rounded-md border"
      @update:model-value="emit('update:modelValue', $event as string)"
    >
      <!-- The menus of the toolbar (Heading, the link popover) open on top of the editor box,
           which has the same background in dark mode. A darker background sets them apart. -->
      <UTheme
        :ui="{
          dropdownMenu: { content: 'dark:bg-neutral-950' },
          popover: { content: 'dark:bg-neutral-950' },
        }"
      >
        <UEditorToolbar
          :editor="editor"
          :items="items"
          :aria-label="t('pluto.github.editor.toolbar')"
          :class="
            canvas ? 'shrink-0 flex-wrap' : 'sticky top-0 z-10 overflow-x-auto'
          "
          class="border-default bg-default rounded-t-md border-b px-2 py-1.5"
        >
          <template #link>
            <PlutoGithubEditorLink :editor="editor" />
          </template>
          <template #image>
            <PlutoMediaEditorButton :editor="editor" />
          </template>
        </UEditorToolbar>
      </UTheme>
    </UEditor>
  </component>
</template>
