<script setup lang="ts">
import type { Extension, Range } from '@codemirror/state'
// The Markdown code editor of core, on CodeMirror 6. Every character stays
// visible, and the text shows its format as the author types: bold, italic,
// headings, links and code. The marks (`**`, `#`, `[`) stay, a little dimmed.
// The MDC lines get a color: the components (`::name`), the slots (`#title`)
// and the YAML props. A toolbar has the quick formats, with their shortcuts.
// The post editor and the page editor of the docs layer use it.
//
// The model value is the Markdown text, as it is: the editor changes only what
// the author types. `insert`, `focus`, `reveal` and `goToLine` are exposed, and
// `insert` goes to the `toolbar` slot too, as in PlutoMarkdownSource.
//
// `formatMarkdown`, `minimalChange` and `mdcLineKinds` come from the auto-imports
// (`shared/utils`). App code must not import `shared/` with a relative path: the
// server build of pluto keeps its own `shared/` external.
import type { PlutoMarkdownFormat } from '../../../../shared/utils/markdown-format'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands'
import { markdownKeymap, markdownLanguage } from '@codemirror/lang-markdown'
import {
  HighlightStyle,
  LanguageSupport,
  syntaxHighlighting,
} from '@codemirror/language'
import {
  highlightSelectionMatches,
  search,
  searchKeymap,
} from '@codemirror/search'
import {
  Annotation,
  Compartment,
  EditorSelection,
  EditorState,
} from '@codemirror/state'
import {
  Decoration,
  drawSelection,
  EditorView,
  keymap,
  placeholder as placeholderText,
  ViewPlugin,
} from '@codemirror/view'
import { tags } from '@lezer/highlight'

const props = withDefaults(
  defineProps<{
    modelValue: string
    disabled?: boolean
    placeholder?: string
    ariaLabel?: string
    /** Fill the height of the parent and scroll inside. Default: grow with the text. */
    fill?: boolean
    /** The minimum height in lines when it grows with the text. Default 18. */
    minLines?: number
    /** Show all the text in the monospace font (14px), like a code editor. Default: the UI font. */
    monospace?: boolean
  }>(),
  {
    minLines: 18,
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

defineSlots<{
  /** Next to the quick formats, for example the Insert menu. */
  toolbar?: (props: { insert: Insert; focus: () => void }) => unknown
  /** At the end of the toolbar, for example the Visual and Markdown switch. */
  'toolbar-end'?: () => unknown
}>()

type Insert = (text: string, options?: { block?: boolean }) => void

const { t } = usePlutoI18n()

const FORMATS: Array<{
  format: PlutoMarkdownFormat
  icon: string
  keys?: string[]
  key?: string
}> = [
  { format: 'bold', icon: 'i-lucide-bold', keys: ['meta', 'B'], key: 'Mod-b' },
  {
    format: 'italic',
    icon: 'i-lucide-italic',
    keys: ['meta', 'I'],
    key: 'Mod-i',
  },
  {
    format: 'strike',
    icon: 'i-lucide-strikethrough',
    keys: ['meta', 'shift', 'X'],
    key: 'Mod-Shift-x',
  },
  { format: 'code', icon: 'i-lucide-code', keys: ['meta', 'E'], key: 'Mod-e' },
  { format: 'link', icon: 'i-lucide-link', keys: ['meta', 'K'], key: 'Mod-k' },
  { format: 'heading', icon: 'i-lucide-heading' },
  { format: 'bullet', icon: 'i-lucide-list' },
  { format: 'number', icon: 'i-lucide-list-ordered' },
  { format: 'quote', icon: 'i-lucide-text-quote' },
  { format: 'codeblock', icon: 'i-lucide-square-code' },
]

const host = useTemplateRef<HTMLElement>('host')
let view: EditorView | null = null

// A change that comes from the model value, not from the author: no `update:modelValue` for it.
const fromModel = Annotation.define<boolean>()
const editable = new Compartment()

function editableState(disabled: boolean): Extension {
  return [EditorView.editable.of(!disabled), EditorState.readOnly.of(disabled)]
}

// --- Look ------------------------------------------------------------------------

// The format shows on the text, and the marks stay visible but dimmed. Every line has the same
// font size: a heading (`## Title`) is yellow, not larger, so it stays apart from a slot (`#title`).
const hybridStyle = HighlightStyle.define([
  {
    tag: [
      tags.heading1,
      tags.heading2,
      tags.heading3,
      tags.heading4,
      tags.heading5,
      tags.heading6,
    ],
    color: 'var(--ui-warning, #eab308)',
  },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, color: 'var(--ui-primary)' },
  { tag: tags.url, color: 'var(--ui-text-muted)', textDecoration: 'underline' },
  {
    tag: tags.monospace,
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
  },
  { tag: tags.processingInstruction, color: 'var(--ui-text-dimmed)' },
  { tag: tags.quote, color: 'var(--ui-text-muted)', fontStyle: 'italic' },
  {
    tag: [tags.labelName, tags.contentSeparator, tags.comment],
    color: 'var(--ui-text-dimmed)',
  },
])

const LINE_CLASSES = {
  component: Decoration.line({ class: 'cm-pluto-component' }),
  slot: Decoration.line({ class: 'cm-pluto-slot' }),
  props: Decoration.line({ class: 'cm-pluto-props' }),
  code: Decoration.line({ class: 'cm-pluto-code' }),
}

// The MDC lines and the code blocks get their own look. A docs page has a few hundred lines,
// so the plugin reads the whole text again after each change.
const mdcLines = ViewPlugin.fromClass(
  class {
    decorations = Decoration.none

    constructor(view: EditorView) {
      this.decorations = this.build(view)
    }

    update(update: { docChanged: boolean; view: EditorView }) {
      if (update.docChanged) {
        this.decorations = this.build(update.view)
      }
    }

    build(view: EditorView) {
      const kinds = mdcLineKinds(view.state.doc.toString())
      const ranges: Range<Decoration>[] = []
      kinds.forEach((kind, index) => {
        if (kind) {
          ranges.push(
            LINE_CLASSES[kind].range(view.state.doc.line(index + 1).from)
          )
        }
      })
      return Decoration.set(ranges)
    }
  },
  { decorations: (plugin) => plugin.decorations }
)

const theme = EditorView.theme({
  '&': {
    color: 'var(--ui-text)',
    backgroundColor: 'transparent',
    // The host element sets these two variables for the `monospace` prop.
    fontSize: 'var(--pluto-cm-font-size, 15px)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'var(--pluto-cm-font, inherit)',
    lineHeight: '1.7',
  },
  '.cm-content': { padding: '12px 16px', caretColor: 'var(--ui-primary)' },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--ui-primary)',
    borderLeftWidth: '2px',
  },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground':
    {
      backgroundColor:
        'color-mix(in oklab, var(--ui-primary) 22%, transparent)',
    },
  '.cm-selectionMatch': {
    backgroundColor: 'color-mix(in oklab, var(--ui-primary) 12%, transparent)',
  },
  '.cm-placeholder': { color: 'var(--ui-text-dimmed)' },
  '.cm-pluto-component': {
    color: 'var(--ui-primary)',
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
  },
  '.cm-pluto-slot': {
    color: 'var(--ui-secondary, var(--ui-primary))',
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
    fontWeight: '600',
  },
  '.cm-pluto-props': {
    color: 'var(--ui-text-muted)',
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
  },
  '.cm-pluto-code': {
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
    backgroundColor: 'color-mix(in oklab, var(--ui-text) 5%, transparent)',
  },
  // A component, slot, props or code line keeps its own look: no Markdown format inside it. A YAML
  // line before a `---` line would read as a heading (a "setext" heading) and turn yellow.
  '.cm-pluto-component *, .cm-pluto-slot *, .cm-pluto-props *, .cm-pluto-code *':
    {
      color: 'inherit !important',
      fontWeight: 'inherit !important',
      fontStyle: 'inherit !important',
      textDecoration: 'none !important',
    },
  '.cm-panels': {
    backgroundColor: 'var(--ui-bg-elevated)',
    color: 'var(--ui-text)',
  },
  '.cm-panels-top': { borderBottom: '1px solid var(--ui-border)' },
  '.cm-panel.cm-search input, .cm-panel.cm-search button': { fontSize: '13px' },
  '.cm-searchMatch': {
    backgroundColor:
      'color-mix(in oklab, var(--ui-warning, orange) 30%, transparent)',
  },
})

// --- Actions -----------------------------------------------------------------------

function format(kind: PlutoMarkdownFormat): boolean {
  if (!view || props.disabled) {
    return false
  }
  const { from, to } = view.state.selection.main
  const edit = formatMarkdown(view.state.doc.toString(), from, to, kind)
  view.dispatch({
    changes: { from: edit.from, to: edit.to, insert: edit.insert },
    selection: EditorSelection.single(
      edit.selection.anchor,
      edit.selection.head
    ),
    scrollIntoView: true,
    userEvent: 'input.format',
  })
  view.focus()
  return true
}

function focus(): void {
  view?.focus()
}

/**
 * Inserts text in place of the selection and puts the caret after it. With
 * `block`, the text gets a blank line before and after it.
 */
function insert(text: string, options: { block?: boolean } = {}): void {
  if (!view || props.disabled) {
    return
  }
  const before = view.state.doc.toString()
  const { from, to } = view.state.selection.main
  const result = insertMarkdownText(
    before,
    { start: from, end: to },
    text,
    options
  )
  view.dispatch({
    changes: minimalChange(before, result.value),
    selection: EditorSelection.cursor(result.caret),
    scrollIntoView: true,
    userEvent: 'input.insert',
  })
  view.focus()
}

/** Selects the first line of the range and scrolls it to the upper third of the editor. */
function reveal(start: number, end: number): void {
  if (!view) {
    return
  }
  const length = view.state.doc.length
  const from = Math.min(start, length)
  const lineEnd = Math.min(view.state.doc.lineAt(from).to, end, length)
  view.dispatch({
    selection: EditorSelection.single(from, lineEnd),
    effects: EditorView.scrollIntoView(from, {
      y: 'start',
      yMargin: Math.round(view.scrollDOM.clientHeight / 3),
    }),
  })
  view.focus()
}

/**
 * Puts the caret at the start of a line (from 0), and scrolls that line to the top of the
 * editor. The outline of the post editor uses it to jump to a heading.
 */
function goToLine(line: number): void {
  if (!view) {
    return
  }
  const { doc } = view.state
  const from = doc.line(Math.min(Math.max(line, 0) + 1, doc.lines)).from
  view.dispatch({
    selection: EditorSelection.cursor(from),
    effects: EditorView.scrollIntoView(from, { y: 'start', yMargin: 12 }),
  })
  view.focus()
}

defineExpose({ insert, focus, reveal, goToLine })

// --- Setup -------------------------------------------------------------------------

onMounted(() => {
  view = new EditorView({
    parent: host.value!,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        history(),
        drawSelection(),
        EditorView.lineWrapping,
        // Not `markdown()`: it adds the HTML, CSS and JavaScript languages for raw HTML in Markdown
        // (70 KB gzip). The pages have none, and the list commands need only `markdownLanguage`.
        new LanguageSupport(markdownLanguage),
        syntaxHighlighting(hybridStyle),
        mdcLines,
        search({ top: true }),
        highlightSelectionMatches(),
        keymap.of([
          ...FORMATS.filter((item) => item.key).map((item) => ({
            key: item.key!,
            run: () => format(item.format),
          })),
          ...markdownKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...defaultKeymap,
          indentWithTab,
        ]),
        placeholderText(props.placeholder ?? ''),
        editable.of(editableState(Boolean(props.disabled))),
        EditorView.contentAttributes.of({
          'aria-label': props.ariaLabel ?? '',
          'aria-multiline': 'true',
          spellcheck: 'false',
          autocapitalize: 'off',
        }),
        EditorView.updateListener.of((update) => {
          if (
            update.docChanged &&
            !update.transactions.some((transaction) =>
              transaction.annotation(fromModel)
            )
          ) {
            emit('update:modelValue', update.state.doc.toString())
          }
        }),
        theme,
      ],
    }),
  })
})

// The text changed outside the editor (a reload, the other mode): show it, and keep the caret.
watch(
  () => props.modelValue,
  (value) => {
    if (!view || value === view.state.doc.toString()) {
      return
    }
    const caret = Math.min(view.state.selection.main.head, value.length)
    view.dispatch({
      changes: minimalChange(view.state.doc.toString(), value),
      selection: EditorSelection.cursor(caret),
      annotations: fromModel.of(true),
    })
  }
)

watch(
  () => props.disabled,
  (disabled) => {
    view?.dispatch({
      effects: editable.reconfigure(editableState(Boolean(disabled))),
    })
  }
)

onBeforeUnmount(() => {
  view?.destroy()
  view = null
})
</script>

<template>
  <div
    :class="fill ? 'flex h-full min-h-0 flex-col' : undefined"
    class="border-default bg-default w-full rounded-md border"
  >
    <div
      :aria-label="t('pluto.markdown.formatting')"
      role="toolbar"
      class="border-default flex shrink-0 flex-wrap items-center gap-0.5 rounded-t-md border-b px-2 py-1.5"
    >
      <UTooltip
        v-for="item in FORMATS"
        :key="item.format"
        :text="t(`pluto.markdown.format.${item.format}`)"
        :kbds="item.keys"
      >
        <UButton
          :aria-label="t(`pluto.markdown.format.${item.format}`)"
          :icon="item.icon"
          :disabled="disabled"
          color="neutral"
          variant="ghost"
          size="xs"
          square
          @click="format(item.format)"
        />
      </UTooltip>

      <USeparator orientation="vertical" class="mx-1 h-5" />

      <slot :insert="insert" :focus="focus" name="toolbar" />

      <div v-if="$slots['toolbar-end']" class="ms-auto">
        <slot name="toolbar-end" />
      </div>
    </div>

    <div
      ref="host"
      :class="fill ? 'min-h-0 flex-1 [&_.cm-editor]:h-full' : undefined"
      :style="[
        fill ? undefined : { minHeight: `${minLines * 1.7 * 15 + 24}px` },
        monospace
          ? {
              '--pluto-cm-font': 'var(--font-mono, ui-monospace, monospace)',
              '--pluto-cm-font-size': '14px',
            }
          : undefined,
      ]"
      class="pluto-markdown-code-editor"
    />
  </div>
</template>
