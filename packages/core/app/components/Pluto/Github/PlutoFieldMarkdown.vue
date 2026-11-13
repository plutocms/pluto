<script setup lang="ts">
import type { DropdownMenuItem, EditorCustomHandlers } from '@nuxt/ui'
import type { Editor as CoreEditor } from '@tiptap/core'
import type { Editor, JSONContent } from '@tiptap/vue-3'
import { Extension } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import PlutoBlockInsertMenu from '../Block/PlutoBlockInsertMenu.vue'
import PlutoEditorEmbedMenu from '../Editor/PlutoEditorEmbedMenu.vue'
import PlutoEditorImageMenu from '../Editor/PlutoEditorImageMenu.vue'
import PlutoEditorLinkMenu from '../Editor/PlutoEditorLinkMenu.vue'
import PlutoMarkdownSource from './PlutoMarkdownSource.vue'

const props = defineProps<{
  field: PlutoTextField
  modelValue: unknown
  disabled?: boolean
  canvas?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t } = usePlutoI18n()

const value = computed(() =>
  typeof props.modelValue === 'string' ? props.modelValue : ''
)

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

const components = usePlutoContentComponents()
const items = usePlutoMarkdownToolbar({
  link: true,
  image: usePlutoMedia().enabled,
  component: components.list.value.length > 0,
})

const registry = usePlutoRegistry()
const extensions = [
  PlutoLink,
  PlutoContentComponentNode,
  PlutoCodeBlock,
  PlutoEmbedNode,
  PlutoEmbedParagraph.configure({
    providers: () => registry.embedProviders.list.value,
  }),
  PlutoTrailingParagraph,
  PlutoThrottledState,
  PlutoIgnoreAriaHidden,
  Extension.create({
    name: 'plutoFlushOnBlur',
    onBlur: () => flushEditorValue(),
  }),
]

function trimEnd(markdown: string): string {
  return markdown.replace(/(?:\s|&nbsp;)+$/u, '')
}
// UEditor loads its model value again when it differs from its own Markdown. Give it its own last Markdown back,
// or a reload drops a trailing space and the caret leaves the line. These two are plain variables on purpose.
const EMIT_INTERVAL = 200
let lastMarkdown: string | null = null
let emitted: string | null = null
let emitTimer: ReturnType<typeof setTimeout> | undefined

const editorValue = computed(() =>
  lastMarkdown !== null && value.value === emitted ? lastMarkdown : value.value
)

function flushEditorValue() {
  clearTimeout(emitTimer)
  emitTimer = undefined
  if (lastMarkdown === null) {
    return
  }
  const next = trimEnd(lastMarkdown)
  if (next !== trimEnd(value.value)) {
    emitted = next
    emit('update:modelValue', next)
  }
}

function onEditorUpdate(markdown: string) {
  lastMarkdown = markdown
  emitTimer ??= setTimeout(flushEditorValue, EMIT_INTERVAL)
}

onBeforeUnmount(flushEditorValue)

const bubbleItems = usePlutoMarkdownBubbleItems()

const suggestionOptions = {
  placement: 'bottom-start' as const,
  offset: 10,
  flip: false,
  size: {
    padding: 8,
    apply({
      availableHeight,
      elements,
    }: {
      availableHeight: number
      elements: { floating: HTMLElement }
    }) {
      const box = elements.floating.firstElementChild as HTMLElement | null
      if (box) {
        box.style.maxHeight = `${Math.max(Math.min(availableHeight, 384), 120)}px`
      }
    },
  },
}

function bubbleShouldShow({
  editor,
  element,
  view,
  state,
  from,
  to,
}: {
  editor: CoreEditor
  element: HTMLElement
  view: CoreEditor['view']
  state: CoreEditor['state']
  from: number
  to: number
}) {
  const { selection } = state
  if (selection instanceof NodeSelection || selection.empty) {
    return false
  }
  const focused = view.hasFocus() || element.contains(document.activeElement)
  return (
    editor.isEditable && focused && state.doc.textBetween(from, to).length > 0
  )
}
const suggestionItems = usePlutoMarkdownSuggestionItems(() =>
  components.list.value.map((component) => ({
    name: component.name,
    label: component.label,
    icon: component.icon,
  }))
)

const handlers = {
  plutoComponent: {
    canExecute: () => true,
    execute: (editor: Editor, item: { name: string }) =>
      editor.chain().focus().insertPlutoComponent(item.name),
    isActive: () => false,
    isDisabled: undefined,
  },
}

const handleNode = shallowRef<{ node: JSONContent; pos: number }>()
const handleOnEmptyLine = computed(
  () =>
    handleNode.value?.node.type === 'paragraph' &&
    !handleNode.value.node.content?.length
)

const menuNode = shallowRef<{ node: JSONContent; pos: number }>()
function onHandleMenu(editor: Editor, open: boolean) {
  if (open) {
    menuNode.value = handleNode.value
  }
  editor.chain().setMeta('lockDragHandle', open).run()
}

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

    <UEditor
      v-else
      v-slot="{ editor, handlers: editorHandlers }"
      :model-value="editorValue"
      :editable="!disabled"
      :placeholder="placeholder"
      :image="true"
      :mention="false"
      :starter-kit="{ codeBlock: false, underline: false, link: false }"
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
        <PlutoMarkdownToolbar
          :editor="editor"
          :items="items"
          :aria-label="t('pluto.github.editor.toolbar')"
          :class="
            canvas
              ? 'dark:border-default pluto-sticky-toolbar sticky top-2 z-10 -mx-2 shrink-0 rounded-lg border border-[oklch(0_0_0/0.19)] bg-white dark:bg-(--pluto-admin-sidebar)'
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

        <UEditorToolbar
          :editor="editor"
          :items="bubbleItems"
          :should-show="bubbleShouldShow"
          :options="{ placement: 'top', flip: false, offset: 10 }"
          :ui="{ base: 'pluto-editor-arrow-bottom dark:bg-neutral-950' }"
          layout="bubble"
        >
          <template #link>
            <PlutoGithubEditorLink :editor="editor" />
          </template>
        </UEditorToolbar>

        <PlutoEditorLinkMenu :editor="editor" />
        <PlutoEditorEmbedMenu :editor="editor" />
        <PlutoEditorImageMenu :editor="editor" />

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
            <UTooltip
              :text="t('pluto.github.editor.addBlock')"
              :content="{ side: 'left' }"
            >
              <UButton
                :aria-label="t('pluto.github.editor.addBlock')"
                :class="handleUi.handle()"
                icon="i-lucide-plus"
                color="neutral"
                variant="ghost"
                size="sm"
              />
            </UTooltip>
          </UDropdownMenu>
          <UDropdownMenu
            v-else
            :modal="false"
            :items="blockMenu(editor)"
            :content="{ side: 'left' }"
            arrow
            @update:open="(open: boolean) => onHandleMenu(editor, open)"
          >
            <UTooltip
              :text="t('pluto.github.editor.blockHandle')"
              :content="{ side: 'left' }"
            >
              <UButton
                :aria-label="t('pluto.github.editor.blockHandle')"
                :class="handleUi.handle()"
                icon="i-lucide-grip-vertical"
                color="neutral"
                variant="ghost"
                size="sm"
              />
            </UTooltip>
          </UDropdownMenu>
        </UEditorDragHandle>

        <UEditorSuggestionMenu
          :editor="editor"
          :items="suggestionItems"
          :suggestion="{ allow: plutoSlashMenuAllowed }"
          :options="suggestionOptions"
        />
      </UTheme>
    </UEditor>
  </component>
</template>
