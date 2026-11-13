<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import type { PlutoCaretAnchor } from '../../../utils/pluto-caret'
import type PlutoMarkdownCodeEditor from '../Markdown/PlutoMarkdownCodeEditor.vue'
import PlutoPostModeSwitch from './PlutoPostModeSwitch.vue'
import PlutoPostOutline from './PlutoPostOutline.vue'
import PlutoPostPreviewFrame from './PlutoPostPreviewFrame.vue'
import PlutoPostTitle from './PlutoPostTitle.vue'

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
const zen = usePlutoZen()
const form = usePlutoContentForm()
const host = inject(plutoCanvasHostKey, null)
const isDesktop = useMediaQuery('(min-width: 64rem)')

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
  const offset = currentCaret(true)
  saveCaret(offset)
  chosen.value = next
  saved.value = next
  nextTick(() =>
    whenTextReady(() => placeCaret(offset ?? savedCaret() ?? 0), 40, true)
  )
}

const previewItem = computed(() => {
  const { [props.field.name]: _body, ...rest } = form?.item.value ?? {}
  return rest
})
const contentType = computed(() => form?.type.value?.name ?? '')

const toggles = computed(
  () => form?.panelToggles.value ?? { left: false, right: false }
)

const scrollEl = useTemplateRef<HTMLElement>('scroller')
const source =
  useTemplateRef<InstanceType<typeof PlutoMarkdownCodeEditor>>('source')
const preview =
  useTemplateRef<InstanceType<typeof PlutoPostPreviewFrame>>('preview')

function focusText() {
  if (mode.value === 'markdown') {
    source.value?.focus()
    return
  }
  scrollEl.value?.querySelector<HTMLElement>('.ProseMirror')?.focus()
}

function visualEditor(): Editor | undefined {
  const element = scrollEl.value?.querySelector('.ProseMirror') as
    (HTMLElement & { editor?: Editor }) | null
  return element?.editor && !element.editor.isDestroyed
    ? element.editor
    : undefined
}

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
  } catch {}
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

function whenTextReady(run: () => void, tries = 40, force = false) {
  const active = document.activeElement
  if (
    !force &&
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
    setTimeout(whenTextReady, 100, run, tries - 1, force)
  }
}

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

const textReady = ref(false)
let readyTimer: ReturnType<typeof setTimeout> | undefined
function checkTextReady(tries = 80) {
  clearTimeout(readyTimer)
  const selector = mode.value === 'markdown' ? '.cm-editor' : '.ProseMirror'
  if (scrollEl.value?.querySelector(selector) || tries <= 0) {
    textReady.value = true
    return
  }
  readyTimer = setTimeout(checkTextReady, 50, tries - 1)
}
onMounted(() => checkTextReady())
onBeforeUnmount(() => clearTimeout(readyTimer))

const activeHeading = ref(-1)
watch(mode, () => {
  activeHeading.value = -1
  textReady.value = false
  nextTick(() => checkTextReady())
})

const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6'

function visualHeadings(): HTMLElement[] {
  const root = scrollEl.value?.querySelector('.ProseMirror')
  return root ? [...root.querySelectorAll<HTMLElement>(HEADING_SELECTOR)] : []
}

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

const columnClass = 'mx-auto max-w-3xl px-4 sm:ps-14 @min-[55rem]:ps-4'

const split = useCookie<number[]>('pluto-post-split', {
  default: () => [50, 50],
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
})
const dragging = ref(false)
// Read the sizes from the cookie when the preview opens, not at each move: new items end the drag.
const splitStart = shallowRef([...split.value])
watch(showPreview, (open) => {
  if (open) {
    splitStart.value = [...split.value]
  }
})
const splitItems = computed(() => {
  if (!showPreview.value) {
    return [{ id: 'compose', slot: 'compose', order: 1, defaultSize: 100 }]
  }
  const [compose, preview] = splitStart.value
  return [
    {
      id: 'compose',
      slot: 'compose',
      order: 1,
      defaultSize: compose ?? 50,
      minSize: 25,
    },
    {
      id: 'preview',
      slot: 'preview',
      order: 2,
      defaultSize: preview ?? 50,
      minSize: 25,
    },
  ]
})
function onLayout(sizes: number[]) {
  if (sizes.length === 2) {
    split.value = sizes.map((size) => Math.round(size))
  }
}
</script>

<template>
  <div
    :data-pluto-zen-toolbar="
      zen.active.value && zen.hideToolbar.value ? 'hidden' : undefined
    "
    class="flex h-full min-h-0 flex-col"
  >
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
            <div
              :class="toggles.left && 'ps-12'"
              class="@container shrink-0 scrollbar-gutter-stable overflow-hidden"
            >
              <div :class="columnClass">
                <div ref="alerts" class="-mx-2 pt-4 empty:hidden" />
              </div>
            </div>

            <div
              :class="toggles.left && 'ps-12'"
              class="min-h-0 flex-1 transition-[padding] duration-200"
            >
              <div
                ref="scroller"
                class="@container size-full min-h-0 scrollbar-thumb-(--ui-border-accented) scrollbar-gutter-stable overflow-x-hidden overflow-y-auto"
              >
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
                  <div class="relative flex flex-1 flex-col">
                    <div
                      v-if="!textReady"
                      class="bg-default absolute inset-0 z-10 flex flex-col gap-4"
                      aria-hidden="true"
                    >
                      <USkeleton class="h-11 w-full rounded-lg" />
                      <USkeleton class="mt-6 h-4 w-full" />
                      <USkeleton class="h-4 w-11/12" />
                      <USkeleton class="h-4 w-3/4" />
                      <USkeleton class="mt-4 h-6 w-2/5" />
                      <USkeleton class="h-4 w-full" />
                      <USkeleton class="h-4 w-5/6" />
                      <USkeleton class="h-4 w-2/3" />
                    </div>
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
                    <MarkdownEditor
                      v-else
                      ref="source"
                      :model-value="value"
                      :disabled="disabled"
                      :placeholder="
                        field.placeholder ??
                        t('pluto.github.editor.placeholder')
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
              <UTooltip
                :text="
                  zen.active.value
                    ? t('pluto.post.zenExit')
                    : t('pluto.post.zen')
                "
              >
                <UButton
                  :aria-label="
                    zen.active.value
                      ? t('pluto.post.zenExit')
                      : t('pluto.post.zen')
                  "
                  :aria-pressed="zen.active.value"
                  :icon="
                    zen.active.value
                      ? 'i-lucide-minimize-2'
                      : 'i-lucide-maximize-2'
                  "
                  :color="zen.active.value ? 'primary' : 'neutral'"
                  :variant="zen.active.value ? 'soft' : 'ghost'"
                  size="xs"
                  square
                  @mousedown.prevent
                  @click="zen.active.value = !zen.active.value"
                />
              </UTooltip>
              <UTooltip
                v-if="zen.active.value"
                :text="
                  zen.hideToolbar.value
                    ? t('pluto.post.zenShowToolbar')
                    : t('pluto.post.zenHideToolbar')
                "
              >
                <UButton
                  :aria-label="
                    zen.hideToolbar.value
                      ? t('pluto.post.zenShowToolbar')
                      : t('pluto.post.zenHideToolbar')
                  "
                  :aria-pressed="zen.hideToolbar.value"
                  :icon="
                    zen.hideToolbar.value
                      ? 'i-lucide-panel-top-open'
                      : 'i-lucide-panel-top-close'
                  "
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  square
                  @mousedown.prevent
                  @click="zen.hideToolbar.value = !zen.hideToolbar.value"
                />
              </UTooltip>
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
