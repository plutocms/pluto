import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { PlutoPaletteEntry } from '../../shared/utils/blocks/editor'
import type { PlutoHistory } from '../../shared/utils/blocks/history'
import type { PlutoBlockTarget } from '../../shared/utils/blocks/operations'
import type {
  PlutoBlock,
  PlutoBlockDefinition,
  PlutoBlockDoc,
  PlutoBlockLocation,
  PlutoBlocksConfig,
  PlutoBlockSources,
  PlutoCodeBlock,
  PlutoPropValue,
} from '../../shared/utils/blocks/types'
import { computed, inject, ref, shallowRef, watch } from 'vue'
import { acceptedNames, describeBlock } from '../../shared/utils/blocks/editor'
import {
  canRedo,
  canUndo,
  createHistory,
  pushHistory,
  redo,
  resetHistory,
  undo,
} from '../../shared/utils/blocks/history'
import {
  blocksFromMarkdown,
  duplicateBlock,
  insertBlocks,
  moveBlock,
  removeBlock,
  replaceWithMarkdown,
  setProp,
  setSlot,
  updateCode,
  updateText,
} from '../../shared/utils/blocks/operations'
import { parseBlocks } from '../../shared/utils/blocks/parse'
import {
  humanizeName,
  resolveBlockDefinition,
} from '../../shared/utils/blocks/registry'
import { serializeBlocks } from '../../shared/utils/blocks/serialize'
import { findBlock, flatChildren, pathOf } from '../../shared/utils/blocks/tree'

export interface PlutoBlockSelection {
  id: string
  /** `preview` when a click in the preview selected the block, so the preview needs no scroll. */
  source: 'ui' | 'preview'
}

export interface PlutoBlockEditorOptions {
  /** The Markdown text of the field. */
  source: () => string
  /** Called with the new text after each edit, undo and redo. Never called at the start. */
  emit: (value: string) => void
  /** The layers of the block definitions: the component layer and the `plutoBlocks` of the app config. */
  sources?: () => PlutoBlockSources | undefined
  now?: () => number
}

export interface PlutoBlockEditor {
  /** The layers of the block definitions. The palette, the preview and the labels read them here. */
  sources: ComputedRef<PlutoBlockSources>
  doc: ComputedRef<PlutoBlockDoc>
  /** The message of a parse error. The editor then offers the Markdown mode only. */
  error: Ref<string | null>
  selection: Ref<PlutoBlockSelection | null>
  selectedId: ComputedRef<string | null>
  selected: ComputedRef<PlutoBlockLocation | undefined>
  hoverId: Ref<string | null>
  canUndo: ComputedRef<boolean>
  canRedo: ComputedRef<boolean>
  /** True once a block was edited since the editor opened. */
  edited: ComputedRef<boolean>
  /** The ids of the blocks that changed since the editor opened. A dot marks them in the outline. */
  editedIds: ComputedRef<Set<string>>
  palette: Ref<{ open: boolean; target: PlutoBlockTarget | null }>
  /** The components whose children the outline hides. A selection inside one opens it. */
  collapsedIds: Ref<Set<string>>
  toggleCollapsed: (id: string) => void
  select: (id: string | null, source?: 'ui' | 'preview') => void
  openPalette: (target?: PlutoBlockTarget | null) => void
  undo: () => void
  redo: () => void
  insert: (
    entry: PlutoPaletteEntry,
    target?: PlutoBlockTarget | null
  ) => string[]
  remove: (id: string) => void
  duplicate: (id: string) => void
  /** Moves a block by `delta` places in its own list. */
  move: (id: string, delta: number) => void
  moveTo: (id: string, target: PlutoBlockTarget) => void
  setProp: (id: string, key: string, value: PlutoPropValue) => void
  setSlot: (id: string, slot: string, markdown: string) => void
  updateText: (id: string, markdown: string) => void
  updateCode: (
    id: string,
    patch: Partial<Pick<PlutoCodeBlock, 'lang' | 'filename' | 'meta' | 'code'>>
  ) => void
  /** Replaces a block with the blocks parsed from Markdown, and selects the first one. */
  replaceMarkdown: (id: string, markdown: string) => void
  definitionOf: (block: PlutoBlock) => PlutoBlockDefinition | undefined
  describe: (block: PlutoBlock) => ReturnType<typeof describeBlock>
  /** The list that holds a block: the doc, or one slot. */
  siblings: (id: string) => PlutoBlock[]
}

export const plutoBlockEditorKey: InjectionKey<PlutoBlockEditor> =
  Symbol('plutoBlockEditor')

/** The block editor that the calling component sits in. Throws outside a `PlutoBlockEditor`. */
export function usePlutoBlockEditor(): PlutoBlockEditor {
  const editor = inject(plutoBlockEditorKey, null)
  if (!editor) {
    throw new Error('usePlutoBlockEditor() needs a PlutoBlockEditor above it.')
  }
  return editor
}

function tryParse(source: string): {
  doc: PlutoBlockDoc
  error: string | null
} {
  try {
    return { doc: parseBlocks(source), error: null }
  } catch (error) {
    return {
      doc: { blocks: [], gaps: [source] },
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Ids of the blocks whose `original` is gone, over the whole tree. */
function editedBlockIds(
  blocks: PlutoBlock[],
  out = new Set<string>()
): Set<string> {
  for (const block of blocks) {
    if (!block.original) {
      out.add(block.id)
    }
    if (block.kind === 'component') {
      editedBlockIds(flatChildren(block), out)
    }
  }
  return out
}

/**
 * The state of one block editor: the doc, the selection, the undo history and
 * the edit actions. Each edit builds a new doc, writes the text and calls
 * `options.emit`. A block that no edit touched keeps its source bytes, so
 * opening a page and leaving it changes nothing.
 */
export function createPlutoBlockEditor(
  options: PlutoBlockEditorOptions
): PlutoBlockEditor {
  const now = options.now ?? Date.now
  const sources = computed(() => options.sources?.() ?? {})

  const initial = tryParse(options.source())
  const error = ref<string | null>(initial.error)
  const history = shallowRef<PlutoHistory<PlutoBlockDoc>>(
    createHistory(initial.doc)
  )
  const doc = computed(() => history.value.present)
  const selection = ref<PlutoBlockSelection | null>(null)
  const hoverId = ref<string | null>(null)
  const palette = ref<{ open: boolean; target: PlutoBlockTarget | null }>({
    open: false,
    target: null,
  })
  const collapsedIds = ref(new Set<string>())
  let lastEmitted = options.source()

  const selected = computed(() =>
    selection.value ? findBlock(doc.value, selection.value.id) : undefined
  )
  const selectedId = computed(() => selected.value?.block.id ?? null)

  // The text changed outside the editor (a reload, a switch from the Markdown mode).
  watch(options.source, (value) => {
    if (value === lastEmitted) {
      return
    }
    const parsed = tryParse(value)
    error.value = parsed.error
    history.value = resetHistory(parsed.doc)
    lastEmitted = value
    selection.value = null
  })

  const editedIds = computed(() => editedBlockIds(doc.value.blocks))

  function toggleCollapsed(id: string): void {
    const next = new Set(collapsedIds.value)
    if (!next.delete(id)) {
      next.add(id)
    }
    collapsedIds.value = next
  }

  // A block selected in the preview or in the panel must show in the outline: open its parents.
  watch(selection, (current) => {
    if (!current) {
      return
    }
    const parents = pathOf(doc.value, current.id).slice(0, -1)
    if (parents.some((id) => collapsedIds.value.has(id))) {
      collapsedIds.value = new Set(
        [...collapsedIds.value].filter((id) => !parents.includes(id))
      )
    }
  })

  function write(next: PlutoBlockDoc): void {
    const text = serializeBlocks(next)
    lastEmitted = text
    options.emit(text)
  }

  function commit(next: PlutoBlockDoc, key?: string): boolean {
    if (next === doc.value) {
      return false
    }
    history.value = pushHistory(history.value, next, now(), key)
    write(next)
    return true
  }

  function select(id: string | null, source: 'ui' | 'preview' = 'ui'): void {
    selection.value = id ? { id, source } : null
  }

  function siblings(id: string): PlutoBlock[] {
    const found = findBlock(doc.value, id)
    if (!found) {
      return []
    }
    return found.parent
      ? (found.parent.slots[found.slot ?? 'default'] ?? [])
      : doc.value.blocks
  }

  function definitionOf(block: PlutoBlock): PlutoBlockDefinition | undefined {
    return block.kind === 'component'
      ? resolveBlockDefinition(block.name, { sources: sources.value, block })
      : undefined
  }

  /** After the selected block, or into a slot of the selected block that accepts the new component. */
  function defaultTarget(entry: PlutoPaletteEntry): PlutoBlockTarget {
    const current = selected.value
    if (!current) {
      return { index: doc.value.blocks.length }
    }
    if (entry.kind === 'component' && current.block.kind === 'component') {
      const definition = definitionOf(current.block)
      for (const slot of Object.keys(definition?.slots ?? {})) {
        const accepts = definition ? acceptedNames(definition, slot) : undefined
        if (accepts?.includes(entry.name)) {
          return {
            parentId: current.block.id,
            slot,
            index: (current.block.slots[slot] ?? []).length,
          }
        }
      }
    }
    return {
      parentId: current.parent?.id,
      slot: current.slot,
      index: current.index + 1,
    }
  }

  function insert(
    entry: PlutoPaletteEntry,
    target?: PlutoBlockTarget | null
  ): string[] {
    const parsed = blocksFromMarkdown(entry.markdown)
    const result = insertBlocks(
      doc.value,
      parsed.blocks,
      target ?? defaultTarget(entry),
      parsed.gaps
    )
    if (!result) {
      return []
    }
    commit(result.doc)
    if (result.ids[0]) {
      select(result.ids[0])
    }
    return result.ids
  }

  function remove(id: string): void {
    const found = findBlock(doc.value, id)
    if (!found) {
      return
    }
    const list = siblings(id)
    const neighbour =
      list[found.index + 1] ?? list[found.index - 1] ?? found.parent
    commit(removeBlock(doc.value, id))
    select(neighbour?.id ?? null)
  }

  function duplicate(id: string): void {
    const result = duplicateBlock(doc.value, id)
    if (result) {
      commit(result.doc)
      select(result.ids[0] ?? null)
    }
  }

  function moveTo(id: string, target: PlutoBlockTarget): void {
    commit(moveBlock(doc.value, id, target))
  }

  function move(id: string, delta: number): void {
    const found = findBlock(doc.value, id)
    if (!found) {
      return
    }
    const length = siblings(id).length
    const index = Math.max(0, Math.min(found.index + delta, length - 1))
    if (index !== found.index) {
      moveTo(id, { parentId: found.parent?.id, slot: found.slot, index })
    }
  }

  return {
    sources,
    doc,
    error,
    selection,
    selectedId,
    selected,
    hoverId,
    canUndo: computed(() => canUndo(history.value)),
    canRedo: computed(() => canRedo(history.value)),
    edited: computed(() => editedIds.value.size > 0),
    editedIds,
    palette,
    collapsedIds,
    toggleCollapsed,
    select,
    openPalette(target = null) {
      palette.value = { open: true, target }
    },
    undo() {
      history.value = undo(history.value)
      write(history.value.present)
    },
    redo() {
      history.value = redo(history.value)
      write(history.value.present)
    },
    insert,
    remove,
    duplicate,
    move,
    moveTo,
    setProp: (id, key, value) =>
      void commit(setProp(doc.value, id, key, value), `prop:${id}:${key}`),
    setSlot: (id, slot, markdown) =>
      void commit(setSlot(doc.value, id, slot, markdown), `slot:${id}:${slot}`),
    updateText: (id, markdown) =>
      void commit(updateText(doc.value, id, markdown), `text:${id}`),
    updateCode: (id, patch) =>
      void commit(updateCode(doc.value, id, patch), `code:${id}`),
    replaceMarkdown(id, markdown) {
      const result = replaceWithMarkdown(doc.value, id, markdown)
      if (result) {
        commit(result.doc)
        select(result.ids[0] ?? null)
      }
    },
    definitionOf,
    describe: (block) => describeBlock(block, sources.value),
    siblings,
  }
}

/** The id of the top-level block that holds a block. The preview selects at this level. */
export function topLevelId(
  doc: PlutoBlockDoc,
  id: string | null
): string | null {
  return id ? (pathOf(doc, id)[0] ?? null) : null
}

/**
 * The `plutoBlocks` value of the app config, as `PlutoBlocksConfig`. Nuxt types
 * `useAppConfig()` from the literal config of the site, where `'inline'` is a
 * `string`, so read the value through this function, not from `useAppConfig()`.
 */
export function usePlutoBlocksConfig(): () => PlutoBlocksConfig | undefined {
  const appConfig = useAppConfig()
  return () => appConfig.plutoBlocks as unknown as PlutoBlocksConfig | undefined
}

/**
 * The layers of the block definitions for a block editor: the component layer and the
 * `plutoBlocks` value of the app config. The caller passes the component layer in: the two editor
 * roots import it from `#pluto-docs/blocks`, so the data stays in the lazy editor chunk.
 */
export function usePlutoBlockSources(
  components: PlutoBlocksConfig = {}
): () => PlutoBlockSources {
  const blocksConfig = usePlutoBlocksConfig()
  return () => ({ components, overrides: blocksConfig() })
}

/** The texts of the slots of a component: the title of a slot, and the label of its "Add" button. */
export function usePlutoBlockLabels() {
  const { t, tx } = usePlutoI18n()
  const editor = usePlutoBlockEditor()

  function slotLabel(
    definition: PlutoBlockDefinition | undefined,
    slot: string
  ): string {
    const label = definition?.slots?.[slot]?.label
    if (label) {
      return tx(label)
    }
    return slot === 'default'
      ? t('docs.blocks.slots.default')
      : humanizeName(slot)
  }

  /** "Add Card" when the slot takes one kind of block, "Add a block" for the main slot, else "Add to Buttons". */
  function addLabel(
    definition: PlutoBlockDefinition | undefined,
    slot: string
  ): string {
    const accepts = definition?.slots?.[slot]?.accepts
    if (accepts?.length === 1) {
      return t('docs.editor.addItem', {
        name: tx(
          resolveBlockDefinition(accepts[0]!, { sources: editor.sources.value })
            .label
        ),
      })
    }
    if (slot === 'default') {
      return t('docs.editor.addBlock')
    }
    return t('docs.editor.addTo', { name: slotLabel(definition, slot) })
  }

  return { slotLabel, addLabel }
}
