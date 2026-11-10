<script setup lang="ts">
import PlutoBlockInsertMenu from '../Block/PlutoBlockInsertMenu.vue'
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
// See the git-cms skill.
const props = defineProps<{
  field: PlutoTextField
  modelValue: unknown
  disabled?: boolean
  /**
   * The post editor (`post-canvas`) shows this widget as its Visual mode. No label, no mode switch
   * (the post editor has its own), no border: the compose panel has the background of the text.
   * The toolbar is a separate rounded bar that stays at the top while the panel scrolls, and the
   * text fills the rest of the height. No padding: the post editor sets the space around it.
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
        attrs: { class: 'flex flex-col' },
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

// The toolbar items are shared: `usePlutoMarkdownToolbar`. The link, image and
// component buttons are slots. The image button shows when the app has a media
// library, the component menu when the site has block components.
const components = usePlutoContentComponents()
const items = usePlutoMarkdownToolbar({
  link: true,
  image: usePlutoMedia().enabled,
  component: components.list.value.length > 0,
})

// A content component (`::name{props}` then `::`) shows as a chip. See the
// content-components skill.
const extensions = [PlutoContentComponentNode]
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

    <!-- Outside the canvas, the editor root is a bordered box. The editable area has a minimum
         height (in the canvas: the rest of the panel), so a click anywhere in it puts the cursor
         in the text. -->
    <UEditor
      v-else
      v-slot="{ editor }"
      :model-value="value"
      :editable="!disabled"
      :placeholder="placeholder"
      :image="true"
      :mention="false"
      :extensions="extensions"
      :ui="
        canvas
          ? {
              root: 'flex w-full flex-1 flex-col',
              content: 'flex flex-1 cursor-text flex-col',
              base: 'flex-1 px-4 py-3 sm:px-4',
            }
          : {
              root: 'w-full',
              content: 'min-h-96 cursor-text',
              base: 'min-h-96 px-4 py-3 sm:px-4',
            }
      "
      :class="canvas ? 'flex-1' : 'border-default rounded-md border'"
      content-type="markdown"
      class="bg-default w-full"
      @update:model-value="emit('update:modelValue', $event as string)"
    >
      <!-- The menus of the toolbar (Heading, the link popover) open on top of the editor box,
           which has the same background in dark mode. A darker background sets them apart. -->
      <UTheme
        :ui="{
          dropdownMenu: {
            content: 'dark:bg-neutral-950',
            arrow: 'dark:fill-neutral-950',
          },
          popover: {
            content: 'dark:bg-neutral-950',
            arrow: 'dark:fill-neutral-950',
          },
        }"
      >
        <!-- One row: the buttons that do not fit go into the More popover (PlutoMarkdownToolbar). -->
        <PlutoMarkdownToolbar
          :editor="editor"
          :items="items"
          :aria-label="t('pluto.github.editor.toolbar')"
          :class="
            canvas
              ? 'bg-pluto-toolbar sticky top-2 z-10 shrink-0 rounded-lg border shadow-xs'
              : 'bg-default sticky top-0 z-10 rounded-t-md border-b'
          "
          :data-pluto-admin-dark="canvas || undefined"
          class="border-default px-2 py-1.5"
        >
          <template #link>
            <PlutoGithubEditorLink :editor="editor" />
          </template>
          <template #image>
            <PlutoMediaEditorButton :editor="editor" />
          </template>
          <template #component>
            <PlutoBlockInsertMenu :editor="editor" />
          </template>
        </PlutoMarkdownToolbar>
      </UTheme>
    </UEditor>
  </component>
</template>
