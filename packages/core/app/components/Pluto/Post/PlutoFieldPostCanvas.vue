<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import type { PlutoCaretAnchor } from '../../../utils/pluto-caret'
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
// - Markdown: `PlutoMarkdownCodeEditor` (CodeMirror, with syntax colors), `bare`: the toolbar
//   of the Visual editor (sticky, acting on the Markdown) and a bubble toolbar over a selection;
//   it grows with the text. It loads when the author opens Markdown mode.
//
// The left panel of the form shows the outline (the headings). A click on a heading puts the caret
// at the end of it and scrolls it under the sticky toolbar; the heading that has the caret is the
// active item of the outline.
//
// The compose panel has the background of the text. The title of the item (the `titleField` of
// the type) shows above the editor as a large field (`PlutoPostTitle`), not in the right panel
// (`claimFields`). In both modes the title and the text scroll together, in the same column; the
// Visual widget keeps its toolbar at the top (sticky). The text fills the rest of the height, so a
// click below the text puts the cursor in it.
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

// The alerts of the form show above the title, in the column of the text, as wide as the toolbar.
const alertsEl = useTemplateRef<HTMLElement>('alerts')
let releaseAlerts: (() => void) | undefined
watch(
  alertsEl,
  (element) => {
    releaseAlerts?.()
    releaseAlerts = element && host ? host.claimAlerts(element) : undefined
  },
  { flush: 'post', immediate: true }
)
onBeforeUnmount(() => releaseAlerts?.())
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
  if (next === mode.value) {
    chosen.value = next
    saved.value = next
    return
  }
  // The caret goes with the text: the other mode puts it at the same place.
  const offset = currentCaret(true)
  saveCaret(offset)
  chosen.value = next
  saved.value = next
  if (offset !== null) {
    nextTick(() => whenTextReady(() => placeCaret(offset)))
  }
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

// The scroll area of the compose panel: the title and the text of both modes.
const scrollEl = useTemplateRef<HTMLElement>('scroller')
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
  scrollEl.value?.querySelector<HTMLElement>('.ProseMirror')?.focus()
}

/** The Visual editor (Tiptap puts it on its editable element). */
function visualEditor(): Editor | undefined {
  const element = scrollEl.value?.querySelector('.ProseMirror') as
    (HTMLElement & { editor?: Editor }) | null
  return element?.editor && !element.editor.isDestroyed
    ? element.editor
    : undefined
}

/**
 * The caret of the mode that shows, as an offset of the Markdown (`plutoMarkdownCaret`), or null.
 * `fresh`: against the Markdown of the Visual editor now (a switch of mode: the editor gives that
 * text when it closes), else against the value of the form.
 */
function currentCaret(fresh = false): number | null {
  if (mode.value === 'markdown') {
    return source.value ? source.value.caret() : null
  }
  const editor = visualEditor()
  if (!editor) {
    return null
  }
  return plutoMarkdownCaret(
    editor,
    fresh
      ? (editor.markdown?.serialize(editor.getJSON()) ?? value.value)
      : value.value
  )
}

/** Puts the caret of the mode that shows at an offset of the Markdown, focused. */
function placeCaret(offset: number) {
  if (mode.value === 'markdown') {
    source.value?.setCaret(offset)
    return
  }
  const editor = visualEditor()
  if (!editor) {
    return
  }
  const position = plutoVisualCaret(editor, value.value, offset)
  editor
    .chain()
    .focus(position ?? 'start')
    .scrollIntoView()
    .run()
}

// The caret of an item is kept in this browser (localStorage), as an offset of the Markdown: a
// reload, or the next visit, puts it back. Saved after the caret stops for a second, on a switch of
// mode, and when the page closes.
const caretKey = computed(() => {
  const id = form?.item.value?.id
  return form?.editing.value && id !== undefined && id !== null
    ? `pluto-caret:${contentType.value}:${String(id)}`
    : ''
})
function saveCaret(offset = currentCaret()) {
  if (!caretKey.value || offset === null) {
    return
  }
  try {
    localStorage.setItem(
      caretKey.value,
      JSON.stringify(plutoCaretAnchor(value.value, offset))
    )
  } catch {
    // No storage (a private window): the caret is not kept.
  }
}
function savedCaret(): number | null {
  try {
    const stored = caretKey.value ? localStorage.getItem(caretKey.value) : null
    const anchor = stored
      ? (JSON.parse(stored) as Partial<PlutoCaretAnchor>)
      : null
    return anchor && typeof anchor.offset === 'number'
      ? plutoFindCaret(value.value, {
          offset: anchor.offset,
          before: typeof anchor.before === 'string' ? anchor.before : '',
        })
      : null
  } catch {
    return null
  }
}
let caretTimer: ReturnType<typeof setTimeout> | undefined
function saveCaretSoon() {
  clearTimeout(caretTimer)
  caretTimer = setTimeout(saveCaret, 1000)
}
function onPageHide() {
  saveCaret()
}
onMounted(() => window.addEventListener('pagehide', onPageHide))
onBeforeUnmount(() => {
  clearTimeout(caretTimer)
  saveCaret()
  window.removeEventListener('pagehide', onPageHide)
})

/**
 * Runs `run` once the editor of the mode is there (both editors load on demand) and, for an item,
 * its text has loaded. Up to 4 seconds. A field of the form that has the focus meanwhile wins (the
 * author clicked it); the link that opened the page (a client-side navigation keeps its focus) does
 * not.
 */
function whenTextReady(run: () => void, tries = 40) {
  const active = document.activeElement
  if (
    active &&
    active !== scrollEl.value?.querySelector('.ProseMirror') &&
    !active.closest('.cm-editor') &&
    scrollEl.value?.closest('[data-pluto-view]')?.contains(active)
  ) {
    return
  }
  const ready =
    (mode.value === 'markdown'
      ? source.value
      : scrollEl.value?.querySelector('.ProseMirror')) &&
    (!form?.editing.value || value.value !== '')
  if (ready) {
    run()
  } else if (tries > 0) {
    setTimeout(whenTextReady, 100, run, tries - 1)
  }
}

// A new item: the text gets the focus, so the author can type at once. An item: the caret goes
// back where it was (`savedCaret`), if this browser has it.
function focusTextWhenReady(tries = 40) {
  whenTextReady(focusText, tries)
}
onMounted(() => {
  if (!form?.canvas.value) {
    return
  }
  if (!form.editing.value) {
    focusTextWhenReady()
    return
  }
  whenTextReady(() => {
    const offset = savedCaret()
    if (offset !== null) {
      placeCaret(offset)
    }
  })
})

// The heading that has the caret: the active item of the outline. -1: none.
const activeHeading = ref(-1)
watch(mode, () => {
  activeHeading.value = -1
})

const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6'

/** The headings of the Visual editor, in the order of `headings`. */
function visualHeadings(): HTMLElement[] {
  const root = scrollEl.value?.querySelector('.ProseMirror')
  return root ? [...root.querySelectorAll<HTMLElement>(HEADING_SELECTOR)] : []
}

/**
 * Scrolls the Visual panel so the element shows under the sticky toolbar of the widget (the
 * `data-pluto-editor-toolbar` element), with a small gap.
 */
function scrollUnderToolbar(element: HTMLElement) {
  const container = scrollEl.value
  if (!container) {
    return
  }
  const toolbar = container.querySelector<HTMLElement>(
    '[data-pluto-editor-toolbar]'
  )
  const covered = toolbar
    ? toolbar.offsetHeight +
      (Number.parseFloat(getComputedStyle(toolbar).top) || 0)
    : 0
  const top =
    element.getBoundingClientRect().top -
    container.getBoundingClientRect().top +
    container.scrollTop -
    covered -
    16
  container.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' })
}

/** Jumps to a heading: in the editor of the mode, and in the preview. */
function goToHeading(index: number) {
  const heading = headings.value[index]
  if (!heading) {
    return
  }
  activeHeading.value = index
  preview.value?.scrollToHeading(index)
  if (mode.value === 'markdown') {
    source.value?.goToLine(heading.line)
    return
  }
  const element = visualHeadings()[index]
  if (!element) {
    return
  }
  // Tiptap puts the editor on its editable element. The caret goes to the end of the heading; the
  // panel scrolls on its own, so the focus does not scroll.
  const editor = (
    element.closest('.ProseMirror') as
      (HTMLElement & { editor?: Editor }) | null
  )?.editor
  if (editor && !editor.isDestroyed) {
    const start = editor.view.posAtDOM(element, 0)
    const end = start + editor.state.doc.resolve(start).parent.content.size
    editor.commands.focus(end, { scrollIntoView: false })
  }
  scrollUnderToolbar(element)
}

/** Visual: the caret moved. The heading around it, if any. A caret outside the editor changes nothing. */
function onSelectionChange() {
  if (mode.value !== 'visual') {
    return
  }
  const root = scrollEl.value?.querySelector('.ProseMirror')
  const node = document.getSelection()?.anchorNode
  if (!root || !node || !root.contains(node)) {
    return
  }
  saveCaretSoon()
  const element = node instanceof Element ? node : node.parentElement
  const heading = element?.closest<HTMLElement>(HEADING_SELECTOR)
  activeHeading.value =
    heading && root.contains(heading) ? visualHeadings().indexOf(heading) : -1
}

/** Markdown: the line of the caret (from 0). */
function onSourceCursor(line: number) {
  saveCaretSoon()
  activeHeading.value = headings.value.findIndex(
    (heading) => heading.line === line
  )
}

onMounted(() => document.addEventListener('selectionchange', onSelectionChange))
onBeforeUnmount(() =>
  document.removeEventListener('selectionchange', onSelectionChange)
)

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

// The column of the text, in both modes: a gutter at the left for the block buttons of the Visual
// editor, and 16px at the right. With no preview: a readable width in the middle; when the panel has room for
// the buttons beside that column (55rem: 48rem and 3.5rem on each side), the padding is the same on
// both sides, so the column stays centered and the buttons use the free space at its left. Under
// `sm` the editor shows no block buttons (Nuxt UI hides the drag handle), so the column has no
// gutter: 16px on both sides.
const columnClass = computed(() => [
  'px-4 sm:ps-14',
  !showPreview.value && 'mx-auto max-w-3xl @min-[55rem]:ps-4',
])

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
        <PlutoPostOutline
          :headings="headings"
          :active="activeHeading"
          @select="goToHeading"
        />
      </PlutoContentCanvasPanel>

      <!-- The compose panel and the preview of the site, side by side (stacked on a narrow screen). -->
      <USplitter
        :items="splitItems"
        :hit-area-margins="{ coarse: 15, fine: 2.5 }"
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
            <!-- The alerts of the form, in the column of the text: the same width as the column
                 below (the same container, padding and scrollbar room), and as wide as the toolbar
                 (`-mx-2`). Empty: no space. -->
            <div
              :class="toggles.left && 'ps-12'"
              class="@container shrink-0 scrollbar-gutter-stable overflow-hidden"
            >
              <div :class="columnClass">
                <div ref="alerts" class="-mx-2 pt-4 empty:hidden" />
              </div>
            </div>

            <!-- The editor of the mode. While the left panel is closed, its open button floats at
                 the top left, so the editor moves right to keep it free. The title and the text
                 scroll together, in the same column in both modes. -->
            <div
              :class="toggles.left && 'ps-12'"
              class="min-h-0 flex-1 transition-[padding] duration-200"
            >
              <div
                ref="scroller"
                class="@container size-full min-h-0 scrollbar-thumb-(--ui-border-accented) scrollbar-gutter-stable overflow-x-hidden overflow-y-auto"
              >
                <!-- The column of the text (`columnClass`). -->
                <div :class="columnClass" class="flex min-h-full flex-col py-2">
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
                  <!-- Visual: the widget keeps its toolbar at the top (sticky). -->
                  <component
                    :is="visualWidget"
                    v-if="mode === 'visual' && visualWidget"
                    :field="visualField"
                    :model-value="value"
                    :disabled="disabled"
                    class="flex-1"
                    canvas
                    @update:model-value="emit('update:modelValue', $event)"
                  />
                  <!-- Markdown: the toolbar of the Visual mode (sticky); the text grows,
                       and the column scrolls. -->
                  <MarkdownEditor
                    v-else
                    ref="source"
                    :model-value="value"
                    :disabled="disabled"
                    :placeholder="
                      field.placeholder ?? t('pluto.github.editor.placeholder')
                    "
                    :aria-label="field.label"
                    class="flex-1"
                    monospace
                    bare
                    @update:model-value="emit('update:modelValue', $event)"
                    @cursor-line="onSourceCursor"
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
