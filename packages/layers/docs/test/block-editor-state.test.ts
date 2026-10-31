import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import {
  createPlutoBlockEditor,
  topLevelId,
} from '../app/composables/pluto-block-editor'
import { buildPalette } from '../shared/utils/blocks/editor'
import { flatChildren } from '../shared/utils/blocks/tree'
import { corpusBodies } from './helpers/corpus'

// The state of the block editor (the part under the UI): it must never write
// the text on open, every edit writes only the changed block, and Undo and
// Redo give the exact bytes back.

const SOURCE =
  '# Title\n\nFirst text.\n\n::note\nA note.\n::\n\n::card-group\n  :::card\n  ---\n  title: One\n  ---\n  First card.\n  :::\n\n  :::card\n  ---\n  title: Two\n  ---\n  Second card.\n  :::\n::\n\n## Last\n\nEnd.\n'

function create(source = SOURCE) {
  const text = ref(source)
  const emitted: string[] = []
  const editor = createPlutoBlockEditor({
    source: () => text.value,
    emit: (value) => {
      emitted.push(value)
      text.value = value
    },
    sources: () => ({}),
    now: () => 0,
  })
  return { editor, text, emitted }
}

describe('open and save with no edit', () => {
  it('never writes the text, for each of the 48 docs pages', () => {
    for (const { file, body } of corpusBodies()) {
      const { editor, emitted } = create(body)
      expect(emitted, file).toEqual([])
      expect(editor.error.value, file).toBeNull()
      expect(editor.editedIds.value.size, file).toBe(0)
      editor.select(editor.doc.value.blocks[0]?.id ?? null)
      expect(emitted, file).toEqual([])
    }
  })
})

describe('edit actions', () => {
  it('writes only the changed block', () => {
    const { editor, emitted } = create()
    const note = editor.doc.value.blocks.find(
      (block) => block.kind === 'component' && block.name === 'note'
    )!
    editor.setProp(note.id, 'icon', 'i-lucide-info')
    expect(emitted).toHaveLength(1)
    expect(emitted[0]).toBe(
      SOURCE.replace('::note\n', '::note{icon="i-lucide-info"}\n')
    )
    expect([...editor.editedIds.value]).toEqual([note.id])
  })

  it('edits a text and joins typing in one undo step', () => {
    const { editor, emitted } = create()
    const first = editor.doc.value.blocks[0]!
    editor.updateText(first.id, '# Title\n\nFirst')
    editor.updateText(first.id, '# Title\n\nFirst text, changed.')
    expect(emitted).toHaveLength(2)
    editor.undo()
    expect(emitted.at(-1)).toBe(SOURCE)
    expect(editor.canUndo.value).toBe(false)
  })

  it('undo and redo give the same bytes', () => {
    const { editor, emitted } = create()
    const note = editor.doc.value.blocks.find(
      (block) => block.kind === 'component' && block.name === 'note'
    )!
    editor.remove(note.id)
    const removed = emitted.at(-1)!
    expect(removed).not.toContain('::note')
    editor.undo()
    expect(emitted.at(-1)).toBe(SOURCE)
    editor.redo()
    expect(emitted.at(-1)).toBe(removed)
  })

  it('selects the next block after a delete, and the new block after an insert', () => {
    const { editor } = create()
    const first = editor.doc.value.blocks[0]!
    const second = editor.doc.value.blocks[1]!
    editor.remove(first.id)
    expect(editor.selectedId.value).toBe(second.id)
    const entry = buildPalette()
      .flatMap((group) => group.entries)
      .find((item) => item.id === 'component:warning')!
    const ids = editor.insert(entry)
    expect(ids).toHaveLength(1)
    expect(editor.selectedId.value).toBe(ids[0])
  })

  it('moves a block with a delta, in its own list', () => {
    const { editor, emitted } = create()
    const group = editor.doc.value.blocks.find(
      (block) => block.kind === 'component' && block.name === 'card-group'
    )!
    const [one] = flatChildren(group as never)
    editor.move(one!.id, 1)
    expect(emitted.at(-1)!.indexOf('title: Two')).toBeLessThan(
      emitted.at(-1)!.indexOf('title: One')
    )
    // At the end of the list nothing moves.
    const count = emitted.length
    editor.move(one!.id, 5)
    expect(emitted).toHaveLength(count)
  })

  it('inserts a card into the selected card group', () => {
    const { editor, emitted } = create()
    const group = editor.doc.value.blocks.find(
      (block) => block.kind === 'component' && block.name === 'card-group'
    )!
    editor.select(group.id)
    const entry = buildPalette()
      .flatMap((item) => item.entries)
      .find((item) => item.id === 'component:card')!
    editor.insert(entry)
    const cards = flatChildren(
      editor.doc.value.blocks.find((block) => block.id === group.id) as never
    )
    expect(cards).toHaveLength(3)
    expect(emitted.at(-1)).toContain('title: Two')
    expect(emitted.at(-1)).toContain('title: Title')
  })

  it('reads a new text from outside as a new doc', async () => {
    const { editor, text, emitted } = create()
    const before = editor.doc.value
    text.value = '# Other\n\nText.\n'
    await nextTick()
    expect(editor.doc.value).not.toBe(before)
    expect(editor.doc.value.blocks).toHaveLength(1)
    expect(emitted).toEqual([])
    expect(editor.canUndo.value).toBe(false)
  })

  it('keeps a text that its own edit wrote', async () => {
    const { editor, emitted } = create()
    editor.updateText(editor.doc.value.blocks[0]!.id, '# Title\n\nNew.')
    await nextTick()
    expect(emitted).toHaveLength(1)
    expect(editor.canUndo.value).toBe(true)
  })
})

describe('topLevelId', () => {
  it('gives the top-level block of a child', () => {
    const { editor } = create()
    const group = editor.doc.value.blocks.find(
      (block) => block.kind === 'component' && block.name === 'card-group'
    )!
    const [one] = flatChildren(group as never)
    expect(topLevelId(editor.doc.value, one!.id)).toBe(group.id)
    expect(topLevelId(editor.doc.value, null)).toBeNull()
  })
})

describe('collapsed blocks in the outline', () => {
  it('toggles a block', () => {
    const { editor } = create()
    const group = editor.doc.value.blocks.find(
      (block) => block.kind === 'component' && block.name === 'card-group'
    )!
    editor.toggleCollapsed(group.id)
    expect(editor.collapsedIds.value.has(group.id)).toBe(true)
    editor.toggleCollapsed(group.id)
    expect(editor.collapsedIds.value.has(group.id)).toBe(false)
  })

  it('opens the collapsed parents of a selected block', async () => {
    const { editor } = create()
    const group = editor.doc.value.blocks.find(
      (block) => block.kind === 'component' && block.name === 'card-group'
    )!
    const [one] = flatChildren(group as never)
    editor.toggleCollapsed(group.id)
    editor.select(one!.id, 'preview')
    await nextTick()
    expect(editor.collapsedIds.value.has(group.id)).toBe(false)
  })
})
