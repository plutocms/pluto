<script setup lang="ts">
import PlutoMarkdownSource from '../Github/PlutoMarkdownSource.vue'
import PlutoPostOutline from './PlutoPostOutline.vue'
import PlutoPostPreviewFrame from './PlutoPostPreviewFrame.vue'

// The `post-canvas` widget: the body of a post (a Markdown `richtext` field) in the
// canvas layout of the content form, like the page editor of the nuxt-content layer.
//
// - Visual: the rich text widget that the app has for `richtext` (the GitHub CMS
//   Markdown editor, or the editor of a layer), with `canvas`, so it fills the
//   height and has no label.
// - Markdown: the Markdown source and the live preview of the site, side by side.
// - The left panel: the outline (the headings) and the mode switch.
//
// Markdown that the visual editor cannot keep (`findUnsafeMarkdown`) turns Visual
// off. A cookie keeps the last mode. Outside a canvas form it shows the visual widget.
const props = defineProps<{
  field: PlutoTextField
  modelValue: unknown
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t } = usePlutoI18n()
const form = usePlutoContentForm()
const isDesktop = useMediaQuery('(min-width: 64rem)')

const value = computed(() =>
  typeof props.modelValue === 'string' ? props.modelValue : ''
)
const headings = computed(() => plutoMarkdownHeadings(value.value))
const visualBlocked = computed(() => findUnsafeMarkdown(value.value).length > 0)

// The rich text widget of the app: the `richtext` widget, not this one.
const visualWidget = usePlutoContentFieldWidget({
  ...props.field,
  widget: undefined,
})
const visualField = computed(() => ({ ...props.field, widget: undefined }))

type Mode = 'visual' | 'markdown'
const saved = useCookie<Mode | null>('pluto-post-editor-mode', {
  default: () => null,
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
})
const chosen = ref<Mode>(saved.value ?? 'visual')
const mode = computed<Mode>(() =>
  chosen.value === 'visual' && !visualBlocked.value && visualWidget.value
    ? 'visual'
    : 'markdown'
)

function setMode(next: Mode) {
  chosen.value = next
  saved.value = next
}

// The preview gets the other fields of the item, so it can show the title and the date.
const previewItem = computed(() => {
  const { [props.field.name]: _body, ...rest } = form?.item.value ?? {}
  return rest
})
const contentType = computed(() => form?.type.value?.name ?? '')

const visualEl = useTemplateRef<HTMLElement>('visual')
const source =
  useTemplateRef<InstanceType<typeof PlutoMarkdownSource>>('source')
const preview =
  useTemplateRef<InstanceType<typeof PlutoPostPreviewFrame>>('preview')

/** Jumps to a heading: in the editor of the mode, and in the preview. */
function goToHeading(index: number) {
  const heading = headings.value[index]
  if (!heading) {
    return
  }
  if (mode.value === 'markdown') {
    source.value?.goToLine(heading.line)
    preview.value?.scrollToHeading(index)
    return
  }
  const element = visualEl.value?.querySelectorAll(
    '.ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6'
  )[index]
  element?.scrollIntoView({ block: 'start', behavior: 'smooth' })
}

// The split between the source and the preview. The cookie keeps the sizes.
const split = useCookie<number[]>('pluto-post-split', {
  default: () => [50, 50],
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
})
const dragging = ref(false)
const splitItems = computed(() => [
  {
    id: 'source',
    slot: 'source',
    defaultSize: split.value[0] ?? 50,
    minSize: 25,
  },
  {
    id: 'preview',
    slot: 'preview',
    defaultSize: split.value[1] ?? 50,
    minSize: 25,
  },
])
function onLayout(sizes: number[]) {
  split.value = sizes.map((size) => Math.round(size))
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <template v-if="form?.canvas.value">
      <PlutoContentCanvasPanel
        id="outline"
        :label="t('pluto.post.outline')"
        side="left"
        icon="i-lucide-list-tree"
      >
        <PlutoPostOutline
          :headings="headings"
          :mode="mode"
          :disabled="disabled"
          :visual-blocked="visualBlocked || !visualWidget"
          @select="goToHeading"
          @update:mode="setMode"
        />
      </PlutoContentCanvasPanel>

      <!-- Visual: the rich text widget fills the canvas and scrolls its own content. -->
      <div
        v-if="mode === 'visual' && visualWidget"
        ref="visual"
        class="min-h-0 flex-1 overflow-y-auto"
      >
        <component
          :is="visualWidget"
          :field="visualField"
          :model-value="value"
          :disabled="disabled"
          canvas
          @update:model-value="emit('update:modelValue', $event)"
        />
      </div>

      <!-- Markdown: the source and the preview of the site, side by side (stacked on a narrow screen). -->
      <USplitter
        v-else
        :items="splitItems"
        :orientation="isDesktop ? 'horizontal' : 'vertical'"
        :ui="{
          root: 'h-full min-h-0',
          handle:
            'relative bg-(--ui-border) before:absolute before:z-10 before:transition-colors before:duration-150! hover:before:bg-haze-400 hover:before:delay-300! data-[orientation=horizontal]:w-px data-[orientation=vertical]:h-px data-[orientation=horizontal]:before:inset-x-[-2.5px] data-[orientation=horizontal]:before:inset-y-0 data-[orientation=vertical]:before:inset-x-0 data-[orientation=vertical]:before:inset-y-[-2.5px] data-[resize-handle-state=drag]:before:bg-haze-400 data-[resize-handle-state=drag]:before:delay-0!',
        }"
        @layout="onLayout"
        @dragging="(_index: number, value: boolean) => (dragging = value)"
      >
        <template #source>
          <div class="size-full p-4">
            <PlutoMarkdownSource
              ref="source"
              :model-value="value"
              :disabled="disabled"
              :placeholder="
                field.placeholder ?? t('pluto.github.editor.placeholder')
              "
              :aria-label="field.label"
              fill
              @update:model-value="emit('update:modelValue', $event)"
            />
          </div>
        </template>

        <template #preview>
          <PlutoPostPreviewFrame
            ref="preview"
            :content-type="contentType"
            :item="previewItem"
            :markdown="value"
            :class="{ 'pointer-events-none': dragging }"
          />
        </template>
      </USplitter>
    </template>

    <!-- Outside a canvas form: the rich text widget, as a normal field. -->
    <component
      :is="visualWidget"
      v-else-if="visualWidget"
      :field="visualField"
      :model-value="value"
      :disabled="disabled"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </div>
</template>
