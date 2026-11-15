import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { PlutoPaletteEntry } from '#layers/pluto/shared/utils/blocks/editor'
import type { PlutoHistory } from '#layers/pluto/shared/utils/blocks/history'
import type { PlutoBlockTarget } from '#layers/pluto/shared/utils/blocks/operations'
import type {
  PlutoBlock,
  PlutoBlockDefinition,
  PlutoBlockDoc,
  PlutoBlockLocation,
  PlutoBlocksConfig,
  PlutoBlockSources,
  PlutoCodeBlock,
  PlutoPropValue,
} from '#layers/pluto/shared/utils/blocks/types'
import { computed, inject, ref, shallowRef, watch } from 'vue'
import { acceptedNames, describeBlock } from '#layers/pluto/shared/utils/blocks/editor'
import {
  canRedo,
  canUndo,
  createHistory,
  pushHistory,
  redo,
  resetHistory,
  undo,
} from '#layers/pluto/shared/utils/blocks/history'
import {
  blocksFromMarkdown,
  duplicateBlock,
  insertBlocks,
  moveBlock,
  removeBlock,
  replaceWithMarkdown,
  setProp,
  setProps,
  setSlot,
  updateCode,
  updateText,
} from '#layers/pluto/shared/utils/blocks/operations'
import { parseBlocks } from '#layers/pluto/shared/utils/blocks/parse'
import {
  humanizeName,
  resolveBlockDefinition,
} from '#layers/pluto/shared/utils/blocks/registry'
import { serializeBlocks } from '#layers/pluto/shared/utils/blocks/serialize'
import { findBlock, flatChildren, pathOf } from '#layers/pluto/shared/utils/blocks/tree'

export interface PlutoBlockSelection {
  id: string
  source: 'ui' | 'preview'
}

export interface PlutoBlockEditorOptions {
  source: () => string
  emit: (value: string) => void
  sources?: () => PlutoBlockSources | undefined
  now?: () => number
}

export interface PlutoBlockEditor {
  sources: ComputedRef<PlutoBlockSources>
  doc: ComputedRef<PlutoBlockDoc>
  error: Ref<string | null>
  selection: Ref<PlutoBlockSelection | null>
  selectedId: ComputedRef<string | null>
  selected: ComputedRef<PlutoBlockLocation | undefined>
  hoverId: Ref<string | null>
  canUndo: ComputedRef<boolean>
  canRedo: ComputedRef<boolean>
  edited: ComputedRef<boolean>
  editedIds: ComputedRef<Set<string>>
  palette: Ref<{ open: boolean; target: PlutoBlockTarget | null }>
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
  move: (id: string, delta: number) => void
  moveTo: (id: string, target: PlutoBlockTarget) => void
  setProp: (id: string, key: string, value: PlutoPropValue) => void
  setProps: (id: string, patch: Record<string, PlutoPropValue>) => void
  setSlot: (id: string, slot: string, markdown: string) => void
  updateText: (id: string, markdown: string) => void
  updateCode: (
    id: string,
    patch: Partial<Pick<PlutoCodeBlock, 'lang' | 'filename' | 'meta' | 'code'>>
  ) => void
  replaceMarkdown: (id: string, markdown: string) => void
  definitionOf: (block: PlutoBlock) => PlutoBlockDefinition | undefined
  describe: (block: PlutoBlock) => ReturnType<typeof describeBlock>
  siblings: (id: string) => PlutoBlock[]
}

export const plutoBlockEditorKey: InjectionKey<PlutoBlockEditor> =
  Symbol('plutoBlockEditor')

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
    setProps: (id, patch) =>
      void commit(setProps(doc.value, id, patch), `props:${id}`),
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

function usePlutoBlocksConfig(): () => PlutoBlocksConfig | undefined {
  const appConfig = useAppConfig()
  return () => appConfig.plutoBlocks as unknown as PlutoBlocksConfig | undefined
}

export function usePlutoBlockSources(
  components: PlutoBlocksConfig = {}
): () => PlutoBlockSources {
  const blocksConfig = usePlutoBlocksConfig()
  const presets = usePlutoRegistry().blockPresets.list
  return () => ({
    presets: Object.fromEntries(
      presets.value.map((entry) => [entry.definition.name, entry.definition])
    ),
    components,
    overrides: blocksConfig(),
  })
}

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
      ? t('pluto.blocks.slots.default')
      : humanizeName(slot)
  }

  function addLabel(
    definition: PlutoBlockDefinition | undefined,
    slot: string
  ): string {
    const accepts = definition?.slots?.[slot]?.accepts
    if (accepts?.length === 1) {
      return t('pluto.blocks.editor.addItem', {
        name: tx(
          resolveBlockDefinition(accepts[0]!, { sources: editor.sources.value })
            .label
        ),
      })
    }
    if (slot === 'default') {
      return t('pluto.blocks.editor.addBlock')
    }
    return t('pluto.blocks.editor.addTo', { name: slotLabel(definition, slot) })
  }

  return { slotLabel, addLabel }
}
