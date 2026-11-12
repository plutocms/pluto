<script setup lang="ts">
import type { DropdownMenuItem, EditorCustomHandlers } from '@nuxt/ui'
import type { Editor, JSONContent } from '@tiptap/vue-3'
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
// content-components skill. A video URL alone on its line shows as its thumbnail (PlutoEmbedNode).
const registry = usePlutoRegistry()
const extensions = [
  PlutoContentComponentNode,
  PlutoEmbedNode,
  PlutoEmbedParagraph.configure({
    providers: () => registry.embedProviders.list.value,
  }),
  PlutoTrailingParagraph,
]

/**
 * The Markdown of the editor, without the blank lines at the end: the empty last line of the editor
 * (`PlutoTrailingParagraph`) never reaches the file, and an open post stays unchanged.
 */
function trimEnd(markdown: string): string {
  return markdown.replace(/(?:\s|&nbsp;)+$/u, '')
}
// The Markdown that the editor gave last, before the trim. UEditor compares its model value with its
// own Markdown, and loads the value again when they differ: the trimmed value would reload the text
// at each key, and a reload drops a space at the end (`## My `), so the caret jumped out of the line.
// While the value is the trim of what the editor gave, the editor gets its own Markdown back.
const lastMarkdown = ref<string | null>(null)
const editorValue = computed(() =>
  lastMarkdown.value !== null && trimEnd(lastMarkdown.value) === value.value
    ? lastMarkdown.value
    : value.value
)

function onEditorUpdate(markdown: string) {
  lastMarkdown.value = markdown
  if (trimEnd(markdown) !== trimEnd(value.value)) {
    emit('update:modelValue', trimEnd(markdown))
  }
}

// --- Blocks: the bubble toolbar, the drag handle and the slash menu ---------------------------
//
// Like the other editors of Pluto: a selection shows the bubble toolbar (the text marks and the
// link). In the gutter at the left of the text, a block has a grip (drag to move, click for
// Duplicate and Delete), and an empty line has a "+" that opens the block menu for that line (a
// dropdown: no "/" goes into the text). "/" in an empty line opens the same items as a suggestion
// menu. The content components of the site are in it too. The editor always ends with an empty
// line, so the "+" has a place after the last block.
const bubbleItems = usePlutoMarkdownBubbleItems()
const suggestionItems = usePlutoMarkdownSuggestionItems(() =>
  components.list.value.map((component) => ({
    name: component.name,
    label: component.label,
    icon: component.icon,
  }))
)

// The `plutoComponent` kind of the block menu: inserts the component and opens its settings.
const handlers = {
  plutoComponent: {
    canExecute: () => true,
    execute: (editor: Editor, item: { name: string }) =>
      editor.chain().focus().insertPlutoComponent(item.name),
    isActive: () => false,
    isDisabled: undefined,
  },
}

// The block under the drag handle, from its `hover` event.
const handleNode = shallowRef<{ node: JSONContent; pos: number }>()
const handleOnEmptyLine = computed(
  () =>
    handleNode.value?.node.type === 'paragraph' &&
    !handleNode.value.node.content?.length
)

// The block of the open menu of the handle. The pointer can hover other blocks while the menu is
// open; the menu acts on the block where it opened.
const menuNode = shallowRef<{ node: JSONContent; pos: number }>()
function onHandleMenu(editor: Editor, open: boolean) {
  if (open) {
    menuNode.value = handleNode.value
  }
  editor.chain().setMeta('lockDragHandle', open).run()
}

/**
 * The menu of the "+" of an empty line: the items of the block menu (`suggestionItems`). An item
 * puts the caret in that line and runs its handler there, like the "/" menu, with no "/" to remove.
 */
function insertMenu(
  editor: Editor,
  editorHandlers: EditorCustomHandlers
): DropdownMenuItem[][] {
  return suggestionItems.value.map((group) =>
    group.map((item): DropdownMenuItem => {
      if ('type' in item && item.type) {
        return { type: item.type, label: item.label }
      }
      const { kind, label, icon } = item as {
        kind: string
        label?: string
        icon?: string
      }
      return {
        label,
        icon,
        onSelect: () => {
          const current = menuNode.value ?? handleNode.value
          const handler = editorHandlers[kind]
          if (!current || !handler) {
            return
          }
          editor
            .chain()
            .focus()
            .setTextSelection(current.pos + 1)
            .run()
          handler.execute(editor, item).run()
        },
      }
    })
  )
}

/** The menu of the grip: Duplicate and Delete the block under the handle. */
function blockMenu(editor: Editor): DropdownMenuItem[][] {
  const current = menuNode.value ?? handleNode.value
  if (!current?.node?.type) {
    return []
  }
  const node = editor.state.doc.nodeAt(current.pos)
  if (!node) {
    return []
  }
  return [
    [
      {
        label: t('pluto.github.editor.duplicate'),
        icon: 'i-lucide-copy',
        onSelect: () => {
          editor
            .chain()
            .focus()
            .insertContentAt(current.pos + node.nodeSize, node.toJSON())
            .run()
        },
      },
      {
        label: t('pluto.github.editor.remove'),
        icon: 'i-lucide-trash',
        color: 'error' as const,
        onSelect: () => {
          editor
            .chain()
            .focus()
            .deleteRange({ from: current.pos, to: current.pos + node.nodeSize })
            .run()
        },
      },
    ],
  ]
}
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
         in the text. In the canvas, the editor element reaches into the gutter at its left
         (`-ms-14 ps-14`): the block buttons sit there, and the pointer stays in the editor on its
         way to them (Tiptap hides the handle when the pointer leaves the editor). Under `sm`,
         Nuxt UI hides the handle, so there is no gutter. -->
    <UEditor
      v-else
      v-slot="{ editor, handlers: editorHandlers }"
      :model-value="editorValue"
      :editable="!disabled"
      :placeholder="placeholder"
      :image="true"
      :mention="false"
      :extensions="extensions"
      :handlers="handlers"
      :ui="
        canvas
          ? {
              root: 'flex w-full flex-1 flex-col',
              content: 'flex flex-1 cursor-text flex-col',
              base: 'flex-1 px-0 pt-12 pb-3 sm:-ms-14 sm:ps-14 sm:pe-0',
            }
          : {
              root: 'w-full',
              content: 'min-h-96 cursor-text',
              base: 'min-h-96 px-4 py-3 sm:ps-14 sm:pe-4',
            }
      "
      :class="canvas ? 'flex-1' : 'border-default rounded-md border'"
      content-type="markdown"
      class="bg-default w-full"
      @update:model-value="onEditorUpdate($event as string)"
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
              ? 'dark:border-default sticky top-2 z-10 -mx-2 shrink-0 rounded-lg border border-[oklch(0_0_0/0.19)] bg-white shadow-[0px_12px_15px_-15px_#0000007a] dark:bg-(--pluto-admin-sidebar)'
              : 'border-default bg-default sticky top-0 z-10 rounded-t-md border-b'
          "
          class="px-2 py-1.5"
          data-pluto-editor-toolbar
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

        <!-- Over a text selection: the marks and the link. -->
        <UEditorToolbar
          :editor="editor"
          :items="bubbleItems"
          :ui="{ base: 'dark:bg-neutral-950' }"
          layout="bubble"
        >
          <template #link>
            <PlutoGithubEditorLink :editor="editor" />
          </template>
        </UEditorToolbar>

        <!-- In the gutter at the left of the text: the grip of a block (drag to move; a click opens
             Duplicate and Delete), or the "+" of an empty line (the block menu there). No flip:
             the buttons stay in the gutter, so the editor does not scroll sideways. -->
        <UEditorDragHandle
          v-slot="{ ui: handleUi }"
          :editor="editor"
          :options="{ flip: false }"
          @hover="handleNode = $event"
        >
          <UDropdownMenu
            v-if="handleOnEmptyLine"
            :modal="false"
            :items="insertMenu(editor, editorHandlers)"
            :content="{ side: 'bottom', align: 'start' }"
            :ui="{ content: 'max-h-80' }"
            arrow
            @update:open="(open: boolean) => onHandleMenu(editor, open)"
          >
            <UButton
              :aria-label="t('pluto.github.editor.addBlock')"
              :class="handleUi.handle()"
              icon="i-lucide-plus"
              color="neutral"
              variant="ghost"
              size="sm"
            />
          </UDropdownMenu>
          <UDropdownMenu
            v-else
            :modal="false"
            :items="blockMenu(editor)"
            :content="{ side: 'left' }"
            arrow
            @update:open="(open: boolean) => onHandleMenu(editor, open)"
          >
            <UButton
              :aria-label="t('pluto.github.editor.blockHandle')"
              :class="handleUi.handle()"
              icon="i-lucide-grip-vertical"
              color="neutral"
              variant="ghost"
              size="sm"
            />
          </UDropdownMenu>
        </UEditorDragHandle>

        <!-- "/" in an empty line: the block menu. Not in code (plutoSlashMenuAllowed). -->
        <UEditorSuggestionMenu
          :editor="editor"
          :items="suggestionItems"
          :suggestion="{ allow: plutoSlashMenuAllowed }"
          :ui="{ content: 'dark:bg-neutral-950' }"
        />
      </UTheme>
    </UEditor>
  </component>
</template>
