<script setup lang="ts">
// The `mdc` widget of the docs layer. It edits the Markdown (MDC) body
// of a page in one of two modes:
//
// - Visual: the block editor. A live preview in the middle, the block list at
//   the left and the controls of the selected block at the right. It needs the
//   'canvas' form layout (the docs type uses it) and loads on demand, so
//   Tiptap and the remark parser stay out of the other admin pages.
// - Markdown: `PlutoMarkdownCodeEditor` of core (CodeMirror: the author sees all the MDC,
//   with the format shown as they type, quick formats and an Insert menu). In a canvas form the live preview shows at
//   its side, and a click on a block in the preview goes to that block in the
//   Markdown (PlutoBlockMarkdownSplit, loaded on demand too).
//
// The first mode is the `editor` option of the field (`visual` or `source`). A
// cookie keeps the last choice of the author. The model value is the Markdown
// text, as it is. The widget contract: props `field`, `modelValue`, `disabled`,
// and the `update:modelValue` event. The layer registers it as the widget `mdc`.
import { defineAsyncComponent } from 'vue'
import PlutoMdcInsertMenu from './PlutoMdcInsertMenu.vue'

const props = defineProps<{
  field: PlutoTextField
  modelValue: unknown
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// The block editor and the Markdown split load on demand. The skeleton shows while they load.
const loadingComponent = () =>
  h('div', { class: 'flex h-full flex-col gap-3 p-6' }, [
    h(resolveComponent('USkeleton'), { class: 'h-8 w-1/3' }),
    h(resolveComponent('USkeleton'), { class: 'h-64 w-full' }),
  ])
const PlutoBlockEditor = defineAsyncComponent({
  loader: () => import('./Blocks/PlutoBlockEditor.vue'),
  loadingComponent,
  delay: 120,
})
const PlutoBlockMarkdownSplit = defineAsyncComponent({
  loader: () => import('./Blocks/PlutoBlockMarkdownSplit.vue'),
  loadingComponent,
  delay: 120,
})

const { t } = usePlutoI18n()
const form = usePlutoContentForm()

const value = computed(() =>
  typeof props.modelValue === 'string' ? props.modelValue : ''
)

// Visual needs the canvas layout: the panels live in the form.
const canVisual = computed(() => Boolean(form?.canvas.value))

type Mode = 'visual' | 'markdown'
const saved = useCookie<Mode | null>('pluto-mdc-editor-mode', {
  default: () => null,
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
})
const mode = ref<Mode>(
  canVisual.value
    ? (saved.value ?? (props.field.editor === 'source' ? 'markdown' : 'visual'))
    : 'markdown'
)

function setMode(next: Mode) {
  mode.value = next
  saved.value = next
}
</script>

<template>
  <PlutoBlockEditor
    v-if="mode === 'visual' && canVisual"
    :model-value="value"
    :disabled="disabled"
    :mode="mode"
    @update:model-value="emit('update:modelValue', $event)"
    @update:mode="setMode"
  />

  <PlutoBlockMarkdownSplit
    v-else-if="canVisual"
    :model-value="value"
    :disabled="disabled"
    :mode="mode"
    :placeholder="field.placeholder ?? t('docs.mdc.placeholder')"
    :label="field.label"
    @update:model-value="emit('update:modelValue', $event)"
    @update:mode="setMode"
  />

  <!-- A form without the canvas layout: the Markdown only, with no preview and no Visual mode. -->
  <UFormField
    v-else
    :label="field.label"
    :description="field.description"
    :required="field.required"
  >
    <!-- The core editor (CodeMirror) loads on demand, so the Visual mode does not load it. -->
    <LazyPlutoMarkdownCodeEditor
      :model-value="value"
      :disabled="disabled"
      :placeholder="field.placeholder ?? t('docs.mdc.placeholder')"
      :aria-label="field.label"
      @update:model-value="emit('update:modelValue', $event)"
    >
      <template #toolbar="{ insert }">
        <PlutoMdcInsertMenu :insert="insert" :disabled="disabled" />
      </template>
    </LazyPlutoMarkdownCodeEditor>
  </UFormField>
</template>
