<script setup lang="ts">
import type PlutoMarkdownCodeEditor from '../Markdown/PlutoMarkdownCodeEditor.vue'
import PlutoPostModeSwitch from './PlutoPostModeSwitch.vue'
import PlutoPostOutline from './PlutoPostOutline.vue'
import PlutoPostPreviewFrame from './PlutoPostPreviewFrame.vue'

// The `post-canvas` widget: the body of a post (a Markdown `richtext` field) in the
// canvas layout of the content form, like the page editor of the docs layer.
//
// The canvas is a split: the compose panel on the left, the live preview of the site
// on the right. The compose panel shows one of two editors, and the switch in its
// footer picks it:
//
// - Visual: the rich text widget that the app has for `richtext` (the Git CMS
//   Markdown editor, or the editor of a layer), with `canvas`, so it fills the
//   height and has no label.
// - Markdown: `PlutoMarkdownCodeEditor` (CodeMirror, with syntax colors). It loads
//   when the author opens Markdown mode.
//
// The left panel of the form shows the outline (the headings).
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

const MarkdownEditor = defineAsyncComponent(
  () => import('../Markdown/PlutoMarkdownCodeEditor.vue')
)

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

// The floating "open" buttons of the closed side panels. The editor and the preview keep their
// corners free.
const toggles = computed(
  () => form?.panelToggles.value ?? { left: false, right: false }
)

const visualEl = useTemplateRef<HTMLElement>('visual')
const source =
  useTemplateRef<InstanceType<typeof PlutoMarkdownCodeEditor>>('source')
const preview =
  useTemplateRef<InstanceType<typeof PlutoPostPreviewFrame>>('preview')

/** Jumps to a heading: in the editor of the mode, and in the preview. */
function goToHeading(index: number) {
  const heading = headings.value[index]
  if (!heading) {
    return
  }
  preview.value?.scrollToHeading(index)
  if (mode.value === 'markdown') {
    source.value?.goToLine(heading.line)
    return
  }
  const element = visualEl.value?.querySelectorAll(
    '.ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6'
  )[index]
  element?.scrollIntoView({ block: 'start', behavior: 'smooth' })
}

// The split between the compose panel and the preview. The cookie keeps the sizes.
const split = useCookie<number[]>('pluto-post-split', {
  default: () => [50, 50],
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
})
const dragging = ref(false)
const splitItems = computed(() => [
  {
    id: 'compose',
    slot: 'compose',
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
        <PlutoPostOutline :headings="headings" @select="goToHeading" />
      </PlutoContentCanvasPanel>

      <!-- The compose panel and the preview of the site, side by side (stacked on a narrow screen). -->
      <USplitter
        :items="splitItems"
        :orientation="isDesktop ? 'horizontal' : 'vertical'"
        :ui="{
          root: 'h-full min-h-0',
          handle:
            'relative bg-border before:absolute before:z-10 before:transition-colors before:duration-150! hover:before:bg-haze-400 hover:before:delay-300! data-[orientation=horizontal]:w-px data-[orientation=vertical]:h-px data-[orientation=horizontal]:before:inset-x-[-2.5px] data-[orientation=horizontal]:before:inset-y-0 data-[orientation=vertical]:before:inset-x-0 data-[orientation=vertical]:before:inset-y-[-2.5px] data-[resize-handle-state=drag]:before:bg-haze-400 data-[resize-handle-state=drag]:before:delay-0!',
        }"
        @layout="onLayout"
        @dragging="(_index: number, value: boolean) => (dragging = value)"
      >
        <template #compose>
          <div class="flex size-full min-h-0 flex-col">
            <!-- The editor of the mode, 8px from the edges. While the left panel is closed, its
                 open button floats at the top left, so the editor moves right to keep it free. -->
            <div
              :class="toggles.left && 'ps-12'"
              class="min-h-0 flex-1 p-2 transition-[padding] duration-200"
            >
              <!-- Visual: the rich text widget scrolls its own content. -->
              <div
                v-if="mode === 'visual' && visualWidget"
                ref="visual"
                class="size-full min-h-0 overflow-y-auto"
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

              <MarkdownEditor
                v-else
                ref="source"
                :model-value="value"
                :disabled="disabled"
                :placeholder="
                  field.placeholder ?? t('pluto.github.editor.placeholder')
                "
                :aria-label="field.label"
                fill
                monospace
                @update:model-value="emit('update:modelValue', $event)"
              />
            </div>

            <div
              class="border-default flex h-12 shrink-0 items-center gap-2 border-t px-3"
            >
              <PlutoPostModeSwitch
                :mode="mode"
                :disabled="disabled"
                :visual-blocked="visualBlocked || !visualWidget"
                @update:mode="setMode"
              />
            </div>
          </div>
        </template>

        <template #preview>
          <PlutoPostPreviewFrame
            ref="preview"
            :content-type="contentType"
            :item="previewItem"
            :markdown="value"
            :gutter-end="toggles.right"
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
