import { describe, expect, it } from 'vitest'
import {
  buildPalette,
  describeBlock,
  plainExcerpt,
  resolveSlotMode,
  slotMarkdown,
  toPreviewBlocks,
} from '../shared/utils/blocks/editor'
import { parseBlocks } from '../shared/utils/blocks/parse'
import { findBlock } from '../shared/utils/blocks/tree'

// The pure helpers of the editor UI: labels, excerpts, slot editors, the
// blocks sent to the preview, and the palette.

function first(source: string) {
  return parseBlocks(source).blocks[0]!
}

describe('plainExcerpt', () => {
  it('removes the Markdown marks and cuts a long text', () => {
    expect(plainExcerpt('**Bold** and [a link](/x) and `code`')).toBe(
      'Bold and a link and code'
    )
    expect(plainExcerpt('x'.repeat(100), 10)).toHaveLength(10)
  })
})

describe('describeBlock', () => {
  it('names a text block by its heading', () => {
    const info = describeBlock(first('## Install the thing\n\nText.'))
    expect(info).toMatchObject({
      label: 'docs.blocks.kinds.text',
      icon: 'i-lucide-heading',
      excerpt: 'Install the thing',
    })
  })

  it('names a code block by its file name or language', () => {
    expect(
      describeBlock(first('```ts [app.ts]\nconst a = 1\n```')).excerpt
    ).toBe('app.ts')
    expect(describeBlock(first('```bash\nls\n```')).excerpt).toBe('bash')
  })

  it('names a table block', () => {
    expect(describeBlock(first('| a | b |\n| - | - |\n| 1 | 2 |')).label).toBe(
      'docs.blocks.kinds.table'
    )
  })

  it('uses the title, the label, or the first text of a component', () => {
    expect(
      describeBlock(first('::card\n---\ntitle: Hello\n---\nBody.\n::')).excerpt
    ).toBe('Hello')
    expect(describeBlock(first('::note\nA short note.\n::')).excerpt).toBe(
      'A short note.'
    )
    expect(describeBlock(first('::note\nA short note.\n::'))).toMatchObject({
      label: 'docs.blocks.note.label',
      name: 'note',
    })
  })

  it('uses a site override for the label', () => {
    expect(
      describeBlock(first('::pluto-chip\nText\n::'), {
        overrides: { 'pluto-chip': { label: 'Chip', icon: 'i-lucide-tag' } },
      })
    ).toMatchObject({ label: 'Chip', icon: 'i-lucide-tag' })
  })
})

describe('resolveSlotMode', () => {
  it('uses the rich editor for a text slot', () => {
    const note = first('::note\nA note.\n::')
    expect(
      note.kind === 'component' && resolveSlotMode(note, 'default', 'rich')
    ).toBe('rich')
  })

  it('uses a single line input for an inline slot', () => {
    const hero = first('::pluto-hero\n#title\nYour title\n::')
    expect(
      hero.kind === 'component' && resolveSlotMode(hero, 'title', 'inline')
    ).toBe('inline')
  })

  it('falls back to Markdown when the slot has syntax that the text editor would lose', () => {
    const hero = first('::pluto-hero\n#title\nA [big heart]{.text-primary}\n::')
    expect(
      hero.kind === 'component' && resolveSlotMode(hero, 'title', 'inline')
    ).toBe('markdown')
    const note = first('::note\n| a | b |\n| - | - |\n| 1 | 2 |\n::')
    expect(
      note.kind === 'component' && resolveSlotMode(note, 'default', 'rich')
    ).toBe('markdown')
  })

  it('falls back to the block list when the slot has a component or code', () => {
    const note = first('::note\nText.\n\n```ts\nconst a = 1\n```\n::')
    expect(
      note.kind === 'component' && resolveSlotMode(note, 'default', 'rich')
    ).toBe('blocks')
  })

  it('keeps the block list for a blocks slot', () => {
    const group = first('::card-group\n  :::card\n  Text.\n  :::\n::')
    expect(
      group.kind === 'component' && resolveSlotMode(group, 'default', 'blocks')
    ).toBe('blocks')
  })

  it('gives the text of a slot back', () => {
    const note = first('::note\nOne.\n\nTwo.\n::')
    expect(note.kind === 'component' && slotMarkdown(note, 'default')).toBe(
      'One.\n\nTwo.'
    )
  })
})

describe('toPreviewBlocks', () => {
  it('sends the Markdown of each top-level block, with the label of a component', () => {
    const doc = parseBlocks('# T\n\n::note\nA note.\n::\n')
    const blocks = toPreviewBlocks(doc.blocks)
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toEqual({ id: doc.blocks[0]!.id, markdown: '# T' })
    expect(blocks[1]).toMatchObject({
      markdown: '::note\nA note.\n::',
      label: 'docs.blocks.note.label',
    })
  })

  it('marks a block that has preview false', () => {
    const doc = parseBlocks('::pluto-palette\n::\n')
    expect(
      toPreviewBlocks(doc.blocks, {
        overrides: { 'pluto-palette': { preview: false } },
      })[0]
    ).toMatchObject({ preview: false })
  })

  it('keeps the id of a nested block findable in its parent', () => {
    const doc = parseBlocks('::card-group\n  :::card\n  Text.\n  :::\n::\n')
    const group = doc.blocks[0]!
    expect(findBlock(doc, group.id)?.block).toBe(group)
  })
})

describe('buildPalette', () => {
  it('has the built-in blocks first, then the component groups', () => {
    const groups = buildPalette()
    expect(groups[0]!.entries.map((entry) => entry.kind)).toEqual([
      'text',
      'table',
    ])
    expect(groups.map((group) => group.group)).toEqual(
      expect.arrayContaining(['text', 'code', 'callouts', 'layout', 'landing'])
    )
    const ids = groups.flatMap((group) =>
      group.entries.map((entry) => entry.id)
    )
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('component:note')
  })

  it('has insert text that parses as one block', () => {
    for (const entry of buildPalette().flatMap((group) => group.entries)) {
      expect(
        parseBlocks(entry.markdown).blocks.length,
        entry.id
      ).toBeGreaterThan(0)
    }
  })

  it('shows only the accepted blocks inside a component', () => {
    const entries = buildPalette({}, ['card']).flatMap((group) => group.entries)
    expect(entries.map((entry) => entry.id)).toEqual(['component:card'])
  })

  it('lists a site block and hides a block set to false', () => {
    const groups = buildPalette({
      overrides: {
        'site-thing': { label: 'Thing', icon: 'i-lucide-box', group: 'site' },
        note: false,
      },
    })
    const ids = groups.flatMap((group) =>
      group.entries.map((entry) => entry.id)
    )
    expect(ids).toContain('component:site-thing')
    expect(ids).not.toContain('component:note')
  })
})
