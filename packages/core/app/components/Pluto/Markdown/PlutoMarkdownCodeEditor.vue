<script setup lang="ts">
import type { Extension, Range } from '@codemirror/state'
import type { MarkdownParser } from '@lezer/markdown'
import type { DropdownMenuItem } from '@nuxt/ui'
import type { PlutoMedia } from '../../../../shared/types/media'
import type { PlutoMarkdownFormat } from '../../../../shared/utils/markdown-format'
import type { PlutoMarkdownToolbarItem } from './PlutoMarkdownToolbarEntry.vue'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  redo,
  redoDepth,
  undo,
  undoDepth,
} from '@codemirror/commands'
import { markdownKeymap, markdownLanguage } from '@codemirror/lang-markdown'
import {
  HighlightStyle,
  Language,
  LanguageDescription,
  LanguageSupport,
  ParseContext,
  syntaxHighlighting,
  syntaxTree,
} from '@codemirror/language'
import { languages } from '@codemirror/language-data'
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
  Prec,
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
import { parseCode } from '@lezer/markdown'
import { writeEmptyComponent } from '#layers/pluto/shared/markdown/component'
import PlutoMarkdownToolbarEntry from './PlutoMarkdownToolbarEntry.vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    disabled?: boolean
    placeholder?: string
    ariaLabel?: string
    fill?: boolean
    minLines?: number
    monospace?: boolean
    bare?: boolean
  }>(),
  {
    minLines: 18,
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  cursorLine: [line: number]
}>()

defineSlots<{
  toolbar?: (props: { insert: Insert; focus: () => void }) => unknown
  'toolbar-end'?: () => unknown
}>()

type Insert = (text: string, options?: { block?: boolean }) => void

const { t, tx } = usePlutoI18n()

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

const fromModel = Annotation.define<boolean>()
const editable = new Compartment()

function editableState(disabled: boolean): Extension {
  return [EditorView.editable.of(!disabled), EditorState.readOnly.of(disabled)]
}

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
    fontWeight: '700',
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

function codeParser(info: string) {
  const name = /\S*/.exec(info)?.[0]
  const found = name
    ? LanguageDescription.matchLanguageName(languages, name, true)
    : null
  if (!found) {
    return null
  }
  return found.support
    ? found.support.language.parser
    : ParseContext.getSkippingParser(found.load())
}

const markdownWithCode = new Language(
  markdownLanguage.data,
  (markdownLanguage.parser as MarkdownParser).configure(
    parseCode({ codeParser })
  ),
  [],
  'markdown'
)

const codeStyle = HighlightStyle.define([
  {
    tag: [
      tags.keyword,
      tags.controlKeyword,
      tags.moduleKeyword,
      tags.bool,
      tags.null,
      tags.self,
    ],
    color: 'var(--pluto-code-keyword)',
  },
  {
    tag: [tags.string, tags.special(tags.string), tags.regexp, tags.character],
    color: 'var(--pluto-code-string)',
  },
  {
    tag: [tags.number, tags.integer, tags.float],
    color: 'var(--pluto-code-number)',
  },
  {
    tag: [
      tags.function(tags.variableName),
      tags.function(tags.propertyName),
      tags.macroName,
    ],
    color: 'var(--pluto-code-function)',
  },
  {
    tag: [tags.typeName, tags.className, tags.namespace, tags.tagName],
    color: 'var(--pluto-code-type)',
  },
  {
    tag: [
      tags.propertyName,
      tags.attributeName,
      tags.definition(tags.propertyName),
    ],
    color: 'var(--pluto-code-property)',
  },
  {
    tag: [tags.lineComment, tags.blockComment, tags.docComment],
    color: 'var(--pluto-code-comment)',
    fontStyle: 'italic',
  },
])

const LINE_CLASSES = {
  component: Decoration.line({ class: 'cm-pluto-component' }),
  slot: Decoration.line({ class: 'cm-pluto-slot' }),
  props: Decoration.line({ class: 'cm-pluto-props' }),
  code: Decoration.line({ class: 'cm-pluto-code' }),
}
const MDC_MARKS = {
  punct: Decoration.mark({ class: 'cm-mdc-punct' }),
  name: Decoration.mark({ class: 'cm-mdc-name' }),
  attr: Decoration.mark({ class: 'cm-mdc-attr' }),
  string: Decoration.mark({ class: 'cm-mdc-string' }),
  literal: Decoration.mark({ class: 'cm-mdc-literal' }),
  slot: Decoration.mark({ class: 'cm-mdc-slot' }),
}

const CODE_EDGES = {
  first: Decoration.line({ class: 'cm-pluto-code-first' }),
  last: Decoration.line({ class: 'cm-pluto-code-last' }),
}

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
        if (!kind) {
          return
        }
        const line = view.state.doc.line(index + 1)
        const from = line.from
        ranges.push(LINE_CLASSES[kind].range(from))
        for (const token of mdcLineTokens(line.text, kind)) {
          if (token.to > token.from) {
            ranges.push(
              MDC_MARKS[token.kind].range(from + token.from, from + token.to)
            )
          }
        }
        if (kind === 'code' && kinds[index - 1] !== 'code') {
          ranges.push(CODE_EDGES.first.range(from))
        }
        if (kind === 'code' && kinds[index + 1] !== 'code') {
          ranges.push(CODE_EDGES.last.range(from))
        }
      })
      return Decoration.set(ranges, true)
    }
  },
  { decorations: (plugin) => plugin.decorations }
)

const MARKS = {
  InlineCode: Decoration.mark({ class: 'cm-pluto-inline-code' }),
  ListMark: Decoration.mark({ class: 'cm-pluto-list-mark' }),
}
const QUOTE_LINE = Decoration.line({ class: 'cm-pluto-quote' })

const markdownLook = ViewPlugin.fromClass(
  class {
    decorations = Decoration.none

    constructor(view: EditorView) {
      this.decorations = this.build(view)
    }

    update(update: {
      docChanged: boolean
      viewportChanged: boolean
      startState: EditorState
      state: EditorState
      view: EditorView
    }) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      ) {
        this.decorations = this.build(update.view)
      }
    }

    build(view: EditorView) {
      const ranges: Range<Decoration>[] = []
      const quoteLines = new Set<number>()
      for (const { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
          from,
          to,
          enter: (node) => {
            if (node.name === 'Blockquote') {
              const first = view.state.doc.lineAt(node.from).number
              const last = view.state.doc.lineAt(node.to).number
              for (let line = first; line <= last; line++) {
                quoteLines.add(line)
              }
            } else if (node.name in MARKS && node.to > node.from) {
              ranges.push(
                MARKS[node.name as keyof typeof MARKS].range(node.from, node.to)
              )
            }
          },
        })
      }
      for (const line of quoteLines) {
        ranges.push(QUOTE_LINE.range(view.state.doc.line(line).from))
      }
      return Decoration.set(ranges, true)
    }
  },
  { decorations: (plugin) => plugin.decorations }
)

const theme = EditorView.theme({
  '&': {
    color: 'var(--ui-text)',
    backgroundColor: 'transparent',
    fontSize: 'var(--pluto-cm-font-size, 15px)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    scrollbarColor: 'var(--ui-border-accented) transparent',
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
  '.cm-pluto-inline-code': {
    backgroundColor: 'color-mix(in oklab, var(--ui-text) 8%, transparent)',
    borderRadius: '4px',
    padding: '0.1em 0.25em',
    fontSize: '0.92em',
  },
  '.cm-pluto-list-mark, .cm-pluto-list-mark *': {
    color: 'var(--ui-primary) !important',
    fontWeight: '600',
  },
  '.cm-line.cm-pluto-quote': {
    borderInlineStart:
      '3px solid color-mix(in oklab, var(--ui-text) 18%, transparent)',
    paddingInlineStart: '12px !important',
  },
  '.cm-pluto-component': {
    color: 'var(--ui-text-muted)',
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
  },
  '.cm-pluto-slot': {
    color: 'var(--ui-text-muted)',
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
  },
  '.cm-pluto-props': {
    color: 'var(--ui-text-muted)',
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
  },
  '.cm-pluto-code': {
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
    backgroundColor: 'color-mix(in oklab, var(--ui-text) 5%, transparent)',
  },
  '.cm-line.cm-pluto-code': { paddingInline: '12px' },
  '.cm-line.cm-pluto-code-first': {
    borderTopLeftRadius: '6px',
    borderTopRightRadius: '6px',
    paddingTop: '4px',
  },
  '.cm-line.cm-pluto-code-last': {
    borderBottomLeftRadius: '6px',
    borderBottomRightRadius: '6px',
    paddingBottom: '4px',
  },
  '.cm-pluto-component :not([class*="cm-mdc-"]), .cm-pluto-slot :not([class*="cm-mdc-"]), .cm-pluto-props :not([class*="cm-mdc-"])':
    {
      color: 'inherit !important',
      fontWeight: 'inherit !important',
      fontStyle: 'inherit !important',
      textDecoration: 'none !important',
      backgroundColor: 'transparent !important',
      padding: '0 !important',
    },
  '.cm-line .cm-mdc-punct': { color: 'var(--ui-text-dimmed) !important' },
  '.cm-line .cm-mdc-name': {
    color: 'var(--ui-primary) !important',
    fontWeight: '600 !important',
  },
  '.cm-line .cm-mdc-attr': { color: 'var(--pluto-code-property) !important' },
  '.cm-line .cm-mdc-string': { color: 'var(--pluto-code-string) !important' },
  '.cm-line .cm-mdc-literal': { color: 'var(--pluto-code-number) !important' },
  '.cm-line .cm-mdc-slot': {
    color: 'var(--pluto-code-keyword) !important',
    fontWeight: '600 !important',
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

// In the theme, not a Tailwind `!` class: an important utility of a layer beats every unlayered rule.
const bareTheme = EditorView.theme({
  '.cm-content': { paddingInline: '0' },
  '.cm-line': { paddingInline: '0' },
})

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

function goToLine(line: number): void {
  if (!view) {
    return
  }
  const { doc } = view.state
  const target = doc.line(Math.min(Math.max(line, 0) + 1, doc.lines))
  view.dispatch({
    selection: EditorSelection.cursor(target.to),
    effects: EditorView.scrollIntoView(target.from, {
      y: 'start',
      yMargin: 12,
    }),
  })
  view.focus()
}

function caret(): number {
  return view?.state.selection.main.head ?? 0
}

function setCaret(offset: number): void {
  if (!view) {
    return
  }
  const at = Math.min(Math.max(Math.trunc(offset), 0), view.state.doc.length)
  view.dispatch({
    selection: EditorSelection.cursor(at),
    effects: EditorView.scrollIntoView(at, { y: 'center' }),
  })
  view.focus()
}

defineExpose({ insert, focus, reveal, goToLine, caret, setCaret })

const steps = ref({ undo: 0, redo: 0 })

function runHistory(command: typeof undo) {
  if (view && !props.disabled) {
    command(view)
    view.focus()
  }
}

function setHeading(level: number) {
  if (!view || props.disabled) {
    return
  }
  const { from, to } = view.state.selection.main
  const edit = headingMarkdown(view.state.doc.toString(), from, to, level)
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
}

const headingItems = computed<DropdownMenuItem[]>(() => [
  {
    label: t('pluto.github.editor.paragraph'),
    icon: 'i-lucide-type',
    onSelect: () => setHeading(0),
  },
  ...[1, 2, 3, 4].map((level) => ({
    label: t(`pluto.github.editor.heading${level}`),
    icon: `i-lucide-heading-${level}`,
    onSelect: () => setHeading(level),
  })),
])

const listItems = computed<DropdownMenuItem[]>(() => [
  {
    label: t('pluto.github.editor.bulletList'),
    icon: 'i-lucide-list',
    onSelect: () => format('bullet'),
  },
  {
    label: t('pluto.github.editor.orderedList'),
    icon: 'i-lucide-list-ordered',
    onSelect: () => format('number'),
  },
])

const media = usePlutoMedia()
const imageOpen = ref(false)
function insertImage(chosen: PlutoMedia[]) {
  const [image] = chosen
  if (image) {
    insert(`![${image.alt ?? ''}](${image.url})`, { block: true })
  }
}

const components = usePlutoContentComponents()
const componentItems = computed<DropdownMenuItem[][]>(() => [
  [
    { type: 'label', label: t('pluto.blocks.insert') },
    ...components.list.value.map((component) => ({
      label: tx(component.label),
      icon: component.icon,
      onSelect: () =>
        insert(writeEmptyComponent(component.name, {}), {
          block: true,
        }),
    })),
  ],
])

function formatButton(
  kind: PlutoMarkdownFormat,
  icon: string,
  label: string
): PlutoMarkdownToolbarItem {
  return {
    kind: 'button',
    id: kind,
    icon,
    label: t(label),
    keys: FORMATS.find((item) => item.format === kind)?.keys,
    disabled: props.disabled,
    run: () => format(kind),
  }
}

const toolbarItems = computed<PlutoMarkdownToolbarItem[]>(() => [
  {
    kind: 'button',
    id: 'undo',
    icon: 'i-lucide-undo',
    label: t('pluto.github.editor.undo'),
    disabled: props.disabled || !steps.value.undo,
    run: () => runHistory(undo),
  },
  {
    kind: 'button',
    id: 'redo',
    icon: 'i-lucide-redo',
    label: t('pluto.github.editor.redo'),
    disabled: props.disabled || !steps.value.redo,
    run: () => runHistory(redo),
  },
  { kind: 'separator', id: 'history' },
  {
    kind: 'menu',
    id: 'headings',
    icon: 'i-lucide-heading',
    label: t('pluto.github.editor.headings'),
    disabled: props.disabled,
    items: headingItems.value,
  },
  {
    kind: 'menu',
    id: 'lists',
    icon: 'i-lucide-list',
    label: t('pluto.github.editor.lists'),
    disabled: props.disabled,
    items: listItems.value,
  },
  formatButton(
    'quote',
    'i-lucide-text-quote',
    'pluto.github.editor.blockquote'
  ),
  formatButton(
    'codeblock',
    'i-lucide-square-code',
    'pluto.github.editor.codeBlock'
  ),
  { kind: 'separator', id: 'blocks' },
  formatButton('bold', 'i-lucide-bold', 'pluto.github.editor.bold'),
  formatButton('italic', 'i-lucide-italic', 'pluto.github.editor.italic'),
  formatButton(
    'strike',
    'i-lucide-strikethrough',
    'pluto.github.editor.strike'
  ),
  formatButton('code', 'i-lucide-code', 'pluto.github.editor.code'),
  formatButton('link', 'i-lucide-link', 'pluto.markdown.format.link'),
  ...(media.enabled
    ? [
        {
          kind: 'button' as const,
          id: 'image',
          icon: 'i-lucide-image',
          label: t('pluto.media.editor.image'),
          disabled: props.disabled,
          run: () => {
            imageOpen.value = true
          },
        },
      ]
    : []),
  ...(components.list.value.length
    ? [
        {
          kind: 'menu' as const,
          id: 'component',
          icon: 'i-lucide-puzzle',
          label: t('pluto.blocks.insert'),
          disabled: props.disabled,
          items: componentItems.value,
        },
      ]
    : []),
])

const toolbarRow = useTemplateRef<HTMLElement>('toolbarRow')
const { width: toolbarWidth } = useElementSize(toolbarRow)
const toolbarSizes = ref({ item: 32, separator: 9, gap: 2 })

function measureToolbar() {
  const row = toolbarRow.value
  const button = row?.querySelector<HTMLElement>('button')
  const separator = row?.querySelector<HTMLElement>('[data-toolbar-separator]')
  if (!row || !button) {
    return
  }
  const style = separator ? getComputedStyle(separator) : null
  toolbarSizes.value = {
    item: button.offsetWidth,
    separator: separator
      ? separator.offsetWidth +
        Number.parseFloat(style!.marginInlineStart) +
        Number.parseFloat(style!.marginInlineEnd)
      : toolbarSizes.value.separator,
    gap: Number.parseFloat(getComputedStyle(row).columnGap) || 0,
  }
}

function entriesWidth(entries: PlutoMarkdownToolbarItem[]): number {
  const { item, separator, gap } = toolbarSizes.value
  return entries.reduce(
    (sum, entry, index) =>
      sum + (entry.kind === 'separator' ? separator : item) + (index ? gap : 0),
    0
  )
}

function trimSeparators(
  entries: PlutoMarkdownToolbarItem[]
): PlutoMarkdownToolbarItem[] {
  const out = [...entries]
  while (out[0]?.kind === 'separator') {
    out.shift()
  }
  while (out.at(-1)?.kind === 'separator') {
    out.pop()
  }
  return out
}

const toolbarSplit = computed(() => {
  const all = toolbarItems.value
  if (toolbarWidth.value === 0 || entriesWidth(all) <= toolbarWidth.value) {
    return { visible: all, overflow: [] as PlutoMarkdownToolbarItem[] }
  }
  const room =
    toolbarWidth.value - toolbarSizes.value.item - toolbarSizes.value.gap
  let count = 0
  while (count < all.length && entriesWidth(all.slice(0, count + 1)) <= room) {
    count++
  }
  return {
    visible: trimSeparators(all.slice(0, count)),
    overflow: trimSeparators(all.slice(count)),
  }
})

const BUBBLE_FORMATS = FORMATS.filter((item) =>
  ['bold', 'italic', 'strike', 'code', 'link'].includes(item.format)
)

const bubble = ref<{ top: number; left: number } | null>(null)

function placeBubble() {
  if (!view || !props.bare) {
    return
  }
  view.requestMeasure({
    key: 'pluto-bubble',
    read: (current) => {
      const selection = current.state.selection.main
      if (selection.empty || !current.hasFocus || props.disabled) {
        return null
      }
      const start = current.coordsAtPos(selection.from)
      const end = current.coordsAtPos(selection.to)
      if (!start || !end) {
        return null
      }
      const left =
        Math.abs(start.top - end.top) < 2
          ? (start.left + end.left) / 2
          : start.left
      return { top: start.top, left }
    },
    write: (position) => {
      bubble.value = position
    },
  })
}

useEventListener('scroll', () => bubble.value && placeBubble(), {
  capture: true,
  passive: true,
})

const EMIT_INTERVAL = 200
let emitted: string | null = null
let emitTimer: ReturnType<typeof setTimeout> | undefined

function flushValue() {
  clearTimeout(emitTimer)
  emitTimer = undefined
  const text = view?.state.doc.toString()
  if (text !== undefined && text !== props.modelValue) {
    emitted = text
    emit('update:modelValue', text)
  }
}

onMounted(() => {
  if (props.bare) {
    nextTick(measureToolbar)
  }
  view = new EditorView({
    parent: host.value!,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        history(),
        drawSelection(),
        EditorView.lineWrapping,
        // Not `markdown()`: it adds the HTML, CSS and JavaScript languages (70 KB gzip).
        new LanguageSupport(markdownWithCode),
        syntaxHighlighting(codeStyle),
        syntaxHighlighting(hybridStyle),
        mdcLines,
        markdownLook,
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
            emitTimer ??= setTimeout(flushValue, EMIT_INTERVAL)
          }
          if (update.focusChanged && !update.view.hasFocus) {
            flushValue()
          }
          if (
            props.bare &&
            (update.selectionSet ||
              update.focusChanged ||
              update.geometryChanged)
          ) {
            placeBubble()
          }
          if (update.docChanged) {
            steps.value = {
              undo: undoDepth(update.state),
              redo: redoDepth(update.state),
            }
          }
          if (update.selectionSet || update.docChanged) {
            const { state } = update
            emit(
              'cursorLine',
              state.doc.lineAt(state.selection.main.head).number - 1
            )
          }
        }),
        theme,
        props.bare ? Prec.high(bareTheme) : [],
      ],
    }),
  })
})

watch(
  () => props.modelValue,
  (value) => {
    if (!view || value === view.state.doc.toString() || value === emitted) {
      return
    }
    emitted = null
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
  flushValue()
  view?.destroy()
  view = null
})
</script>

<template>
  <div
    :class="[
      fill ? 'flex h-full min-h-0 flex-col' : undefined,
      bare ? 'flex flex-col' : 'border-default bg-default rounded-md border',
    ]"
    class="w-full"
  >
    <div
      v-if="!bare"
      :aria-label="t('pluto.markdown.formatting')"
      role="toolbar"
      class="border-default bg-default flex shrink-0 flex-wrap items-center gap-0.5 rounded-t-md border-b px-2 py-1.5"
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
      v-if="bare"
      :aria-label="t('pluto.github.editor.toolbar')"
      role="toolbar"
      class="dark:border-default pluto-sticky-toolbar sticky top-2 z-10 -mx-2 mb-6 flex shrink-0 items-center gap-0.5 rounded-lg border border-[oklch(0_0_0/0.19)] bg-white px-2 py-1.5 dark:bg-(--pluto-admin-sidebar)"
      data-pluto-editor-toolbar
      @mousedown="
        ($event.target as HTMLElement).closest('button') &&
        $event.preventDefault()
      "
    >
      <div
        ref="toolbarRow"
        class="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden"
      >
        <PlutoMarkdownToolbarEntry
          v-for="entry in toolbarSplit.visible"
          :key="entry.id"
          :entry="entry"
        />

        <UPopover
          v-if="toolbarSplit.overflow.length"
          :content="{ align: 'end' }"
          arrow
        >
          <UTooltip :text="t('pluto.markdown.moreTools')">
            <UButton
              :aria-label="t('pluto.markdown.moreTools')"
              icon="i-lucide-ellipsis"
              color="neutral"
              variant="ghost"
              size="sm"
              class="ms-auto shrink-0"
              square
            />
          </UTooltip>

          <template #content>
            <div
              class="flex max-w-64 flex-wrap items-center gap-0.5 p-1"
              @mousedown="
                ($event.target as HTMLElement).closest('button') &&
                $event.preventDefault()
              "
            >
              <PlutoMarkdownToolbarEntry
                v-for="entry in toolbarSplit.overflow"
                :key="entry.id"
                :entry="entry"
              />
            </div>
          </template>
        </UPopover>
      </div>

      <PlutoMediaPicker
        v-if="media.enabled"
        v-model:open="imageOpen"
        :accept="['image/*']"
        @select="insertImage"
      />
    </div>

    <div
      ref="host"
      :class="
        fill
          ? 'min-h-0 flex-1 [&_.cm-editor]:h-full [&_.cm-scroller]:scrollbar-gutter-stable'
          : bare
            ? 'flex flex-1 flex-col [&_.cm-editor]:flex-1'
            : undefined
      "
      :style="[
        fill || bare
          ? undefined
          : { minHeight: `${minLines * 1.7 * 15 + 24}px` },
        monospace
          ? {
              '--pluto-cm-font': 'var(--font-mono, ui-monospace, monospace)',
              '--pluto-cm-font-size': '14px',
            }
          : undefined,
      ]"
      class="pluto-markdown-code-editor"
    />

    <div
      v-if="bare && bubble"
      :aria-label="t('pluto.markdown.formatting')"
      :style="{ top: `${bubble.top - 12}px`, left: `${bubble.left}px` }"
      role="toolbar"
      class="pluto-editor-arrow-bottom bg-default border-default fixed z-50 flex -translate-x-1/2 -translate-y-full gap-0.5 rounded-lg border p-1 shadow-lg dark:bg-neutral-950"
      @mousedown.prevent
    >
      <UTooltip
        v-for="item in BUBBLE_FORMATS"
        :key="item.format"
        :text="t(`pluto.markdown.format.${item.format}`)"
        :kbds="item.keys"
      >
        <UButton
          :aria-label="t(`pluto.markdown.format.${item.format}`)"
          :icon="item.icon"
          color="neutral"
          variant="ghost"
          size="sm"
          square
          @click="format(item.format)"
        />
      </UTooltip>
    </div>
  </div>
</template>
