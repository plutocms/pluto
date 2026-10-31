import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { createPlutoBlockEditor } from '../app/composables/pluto-block-editor'
import { buildPalette } from '../shared/utils/blocks/editor'
import { corpusBodies } from './helpers/corpus'

// The block editor with a component layer. Definitions never feed the parser or the writer, so
// the layer must change nothing in the text.

const components = {
  'pluto-hero': { icon: 'i-lucide-sparkles', group: 'landing' },
  'card-group': { props: { columns: { type: 'number' as const } } },
  note: { props: { to: false as const } },
  card: false as const,
}

describe('the block editor with a component layer', () => {
  it('never writes the text on open, for each of the 48 docs pages', () => {
    for (const { file, body } of corpusBodies()) {
      const text = ref(body)
      const emitted: string[] = []
      const editor = createPlutoBlockEditor({
        source: () => text.value,
        emit: (value) => emitted.push(value),
        sources: () => ({ components }),
        now: () => 0,
      })
      for (const block of editor.doc.value.blocks) {
        editor.definitionOf(block)
        editor.describe(block)
      }
      expect(emitted, file).toEqual([])
      expect(editor.editedIds.value.size, file).toBe(0)
    }
  })

  it('owns the sources, and the palette reads them', () => {
    const editor = createPlutoBlockEditor({
      source: () => '# T\n',
      emit: () => {},
      sources: () => ({ components }),
    })
    expect(editor.sources.value.components).toBe(components)
    const ids = buildPalette(editor.sources.value)
      .flatMap((group) => group.entries)
      .map((entry) => entry.id)
    expect(ids).toContain('component:pluto-hero')
    expect(ids).not.toContain('component:card')
  })

  it('edits the kebab prop of the page and changes only that token', () => {
    const source = '# T\n\n::pluto-hero{star-count=160 center}\n::\n'
    const text = ref(source)
    const emitted: string[] = []
    const editor = createPlutoBlockEditor({
      source: () => text.value,
      emit: (value) => {
        emitted.push(value)
        text.value = value
      },
      sources: () => ({
        components: {
          'pluto-hero': { props: { starCount: { type: 'number' as const } } },
        },
      }),
      now: () => 0,
    })
    const hero = editor.doc.value.blocks[1]!
    const names = Object.keys(editor.definitionOf(hero)!.props!)
    expect(names).toContain('star-count')
    expect(names).not.toContain('starCount')
    editor.setProp(hero.id, 'star-count', 200)
    expect(emitted).toHaveLength(1)
    expect(emitted[0]).toContain('star-count')
    expect(emitted[0]).not.toContain('starCount')
    expect(emitted[0]).toContain('center')
    expect(emitted[0]).not.toContain('160')
  })
})
