<script setup lang="ts">
import type PlutoMarkdownCodeEditor from '../Markdown/PlutoMarkdownCodeEditor.vue'
import PlutoPostModeSwitch from './PlutoPostModeSwitch.vue'
import PlutoPostOutline from './PlutoPostOutline.vue'
import PlutoPostPreviewFrame from './PlutoPostPreviewFrame.vue'
import PlutoPostTitle from './PlutoPostTitle.vue'

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
// The compose panel has the background of the text. The title of the item (the `titleField` of
// the type) shows above the editor as a large field (`PlutoPostTitle`), not in the right panel
// (`claimFields`). In Visual mode the title, the toolbar of the widget and the text scroll
// together; the widget keeps its toolbar at the top (sticky), and its text fills the rest of the
// height, so a click below the text puts the cursor in it.
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
const host = inject(plutoCanvasHostKey, null)
const isDesktop = useMediaQuery('(min-width: 64rem)')

// The title field of the type. In a canvas form it shows above the editor, so the right panel
// leaves it out.
const titleField = computed(() => {
  const type = form?.type.value
  return type?.titleField
    ? type.fields.find(
        (field) => field.name === type.titleField && field.inForm !== false
      )
    : undefined
})
if (host) {
  const release = host.claimFields(() =>
    titleField.value ? [titleField.value.name] : []
  )
  onBeforeUnmount(release)
}
const typeText = usePlutoContentText(() => form?.type.value)
const titleValue = computed(() => {
  const value = titleField.value
    ? form?.item.value[titleField.value.name]
    : undefined
  return typeof value === 'string' ? value : ''
})
const titleError = computed(() =>
  titleField.value
    ? form?.errorsByField.value[titleField.value.name]
    : undefined
)
function setTitle(value: string) {
  if (titleField.value) {
    form?.updateField(titleField.value.name, value)
  }
}

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

/** Enter in the title: the cursor goes to the text. */
function focusText() {
  if (mode.value === 'markdown') {
    source.value?.focus()
    return
  }
  visualEl.value?.querySelector<HTMLElement>('.ProseMirror')?.focus()
}

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

// The preview can be off, so the editor gets the room. A switch in the footer of the compose
// panel turns it on and off. On desktop a cookie keeps the choice (off by default: the editor gets
// the room; the docs editor keeps its own preview on); on a narrow screen it starts off, because the
// stacked split leaves little room to write.
const previewCookie = useCookie<boolean>('pluto-post-preview', {
  default: () => false,
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
})
const previewNarrow = ref(false)
const showPreview = computed({
  get: () => (isDesktop.value ? previewCookie.value : previewNarrow.value),
  set: (value: boolean) => {
    if (isDesktop.value) {
      previewCookie.value = value
    } else {
      previewNarrow.value = value
    }
  },
})

// The split between the compose panel and the preview. The cookie keeps the sizes.
const split = useCookie<number[]>('pluto-post-split', {
  default: () => [50, 50],
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
})
const dragging = ref(false)
const splitItems = computed(() =>
  showPreview.value
    ? [
        {
          id: 'compose',
          slot: 'compose',
          order: 1,
          defaultSize: split.value[0] ?? 50,
          minSize: 25,
        },
        {
          id: 'preview',
          slot: 'preview',
          order: 2,
          defaultSize: split.value[1] ?? 50,
          minSize: 25,
        },
      ]
    : [{ id: 'compose', slot: 'compose', order: 1, defaultSize: 100 }]
)
function onLayout(sizes: number[]) {
  // Only the split with the preview: the compose panel alone is always 100.
  if (sizes.length === 2) {
    split.value = sizes.map((size) => Math.round(size))
  }
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
          <div class="bg-default flex size-full min-h-0 flex-col">
            <!-- The editor of the mode. While the left panel is closed, its open button floats at
                 the top left, so the editor moves right to keep it free. -->
            <div
              :class="toggles.left && 'ps-12'"
              class="min-h-0 flex-1 transition-[padding] duration-200"
            >
              <!-- Visual: the title, the toolbar and the text scroll together. -->
              <div
                v-if="mode === 'visual' && visualWidget"
                ref="visual"
                class="@container size-full min-h-0 overflow-x-hidden overflow-y-auto"
              >
                <!-- A gutter at the left for the block buttons of the editor, and 16px at the right.
                     With no preview, the text keeps a readable width in the middle. When the panel
                     has room for the buttons beside that column (55rem: 48rem and 3.5rem on each
                     side), the padding is the same on both sides, so the column stays centered and
                     the buttons use the free space at its left. -->
                <div
                  :class="!showPreview && 'mx-auto max-w-3xl @min-[55rem]:ps-4'"
                  class="flex min-h-full flex-col py-2 ps-14 pe-4"
                >
                  <PlutoPostTitle
                    v-if="titleField"
                    :model-value="titleValue"
                    :label="typeText.fieldLabel(titleField)"
                    :error="titleError"
                    :disabled="disabled"
                    class="pt-6 pb-3"
                    @update:model-value="setTitle"
                    @next="focusText"
                  />
                  <component
                    :is="visualWidget"
                    :field="visualField"
                    :model-value="value"
                    :disabled="disabled"
                    class="flex-1"
                    canvas
                    @update:model-value="emit('update:modelValue', $event)"
                  />
                </div>
              </div>

              <!-- Markdown: the title, then the code editor fills the rest. -->
              <div
                v-else
                class="flex size-full min-h-0 flex-col py-2 ps-14 pe-4"
              >
                <PlutoPostTitle
                  v-if="titleField"
                  :model-value="titleValue"
                  :label="typeText.fieldLabel(titleField)"
                  :error="titleError"
                  :disabled="disabled"
                  class="shrink-0 pt-6 pb-3"
                  @update:model-value="setTitle"
                  @next="focusText"
                />
                <div class="min-h-0 flex-1">
                  <MarkdownEditor
                    ref="source"
                    :model-value="value"
                    :disabled="disabled"
                    :placeholder="
                      field.placeholder ?? t('pluto.github.editor.placeholder')
                    "
                    :aria-label="field.label"
                    fill
                    monospace
                    bare
                    @update:model-value="emit('update:modelValue', $event)"
                  />
                </div>
              </div>
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
              <USwitch
                v-model="showPreview"
                :label="t('pluto.post.previewSwitch')"
                size="sm"
                class="ms-auto"
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
