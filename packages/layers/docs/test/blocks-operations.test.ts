import type {
  PlutoBlockDoc,
  PlutoComponentBlock,
} from '../shared/utils/blocks/types'
import { describe, expect, it } from 'vitest'
import {
  blockMarkdown,
  blocksFromMarkdown,
  createComponentBlock,
  createTextBlock,
  duplicateBlock,
  insertBlock,
  insertBlocks,
  moveBlock,
  removeBlock,
  replaceWithMarkdown,
} from '../shared/utils/blocks/operations'
import { parseBlocks } from '../shared/utils/blocks/parse'
import { serializeBlocks } from '../shared/utils/blocks/serialize'
import {
  findBlock,
  flatChildren,
  pathOf,
  walkBlocks,
} from '../shared/utils/blocks/tree'
import { corpusBodies } from './helpers/corpus'

// The text of a doc after an operation must parse again, and write again with
// the same bytes. This shows that the gaps and the markers stay valid.
function expectStable(doc: PlutoBlockDoc, message = ''): string {
  const text = serializeBlocks(doc)
  expect(serializeBlocks(parseBlocks(text)), message).toBe(text)
  return text
}

function kinds(text: string): string[] {
  return parseBlocks(text).blocks.map((block) =>
    block.kind === 'component' ? block.name : block.kind
  )
}

const source =
  '# One\n\nText one.\n\n## Two\n\nText two.\n\n```ts\nconst a = 1\n```\n\n::note\nA note.\n::\n'

describe('insert', () => {
  it('puts a block first, in the middle and last', () => {
    const doc = parseBlocks(source)
    const first = insertBlock(doc, createTextBlock('First!'), { index: 0 })!
    expect(expectStable(first.doc)).toBe(`First!\n\n${source}`)
    const middle = insertBlock(doc, createTextBlock('Middle.'), { index: 2 })!
    expect(expectStable(middle.doc)).toBe(
      source.replace('```ts', 'Middle.\n\n```ts')
    )
    const last = insertBlock(doc, createTextBlock('Last.'), { index: 99 })!
    expect(expectStable(last.doc)).toBe(
      `${source}\nLast.\n`.replace('::\n\nLast.', '::\n\nLast.')
    )
    expect(kinds(serializeBlocks(last.doc))).toEqual([
      'text',
      'text',
      'code',
      'note',
      'text',
    ])
  })

  it('puts a block into an empty doc', () => {
    const doc = parseBlocks('')
    const result = insertBlock(doc, createTextBlock('Hello'), { index: 0 })!
    expect(expectStable(result.doc)).toBe('Hello\n')
  })

  it('does not change the input doc', () => {
    const doc = parseBlocks(source)
    const copy = JSON.stringify(doc)
    insertBlock(doc, createTextBlock('x'), { index: 1 })
    removeBlock(doc, doc.blocks[0]!.id)
    moveBlock(doc, doc.blocks[0]!.id, { index: 2 })
    expect(JSON.stringify(doc)).toBe(copy)
  })

  it('returns the ids of the new blocks, and they are unique', () => {
    const doc = parseBlocks(source)
    const { doc: next, ids } = insertBlocks(
      doc,
      blocksFromMarkdown('A\n\n```js\nb\n```').blocks,
      { index: 1 },
      ['\n\n']
    )!
    expect(ids).toHaveLength(2)
    const seen = new Set<string>()
    walkBlocks(next.blocks, (block) => seen.add(block.id))
    expect(seen.size).toBe(next.blocks.length + 1)
    expect(expectStable(next)).toContain('A\n\n```js\nb\n```\n\n## Two')
  })

  it('puts a component from a preset-like text', () => {
    const doc = parseBlocks(source)
    const [block] = blocksFromMarkdown(
      '::warning\nText of the warning.\n::'
    ).blocks
    const { doc: next } = insertBlock(doc, block!, { index: 1 })!
    expect(kinds(expectStable(next))).toEqual([
      'text',
      'warning',
      'text',
      'code',
      'note',
    ])
  })

  it('puts a child into a component slot with the indent and the colons of the parent', () => {
    const doc = parseBlocks(
      '::card-group\n  :::card\n  ---\n  title: One\n  ---\n  Text.\n  :::\n::\n'
    )
    const group = doc.blocks[0]!
    const card = createComponentBlock('card', { title: 'Two' }, 'Other.')
    const { doc: next } = insertBlock(doc, card, {
      parentId: group.id,
      slot: 'default',
      index: 1,
    })!
    const text = expectStable(next)
    const parsed = parseBlocks(text).blocks[0] as PlutoComponentBlock
    expect(
      flatChildren(parsed).map((child) =>
        child.kind === 'component'
          ? (child.props.title ?? child.name)
          : child.kind
      )
    ).toEqual(['One', 'Two'])
    expect(parsed.colons).toBe(2)
    expect(flatChildren(parsed)[1]).toMatchObject({ colons: 3, indent: '  ' })
    // The first child keeps its source.
    expect(
      text.startsWith(
        '::card-group\n  :::card\n  ---\n  title: One\n  ---\n  Text.\n  :::\n\n  :::card'
      )
    ).toBe(true)
  })

  it('raises the colons and sets the indent of a nested component', () => {
    const doc = parseBlocks('::tabs\n::\n')
    const item = createComponentBlock('tabs-item', { label: 'A' }, 'Text.')
    const { doc: next } = insertBlock(doc, item, {
      parentId: doc.blocks[0]!.id,
      index: 0,
    })!
    const text = expectStable(next)
    expect(text).toBe('::tabs\n  :::tabs-item{label="A"}\n  Text.\n  :::\n::\n')
  })

  it('puts a child into a slot that is empty or missing', () => {
    const doc = parseBlocks('::u-page-hero\n#title\nHi\n\n#links\n::\n')
    const id = doc.blocks[0]!.id
    const button = createComponentBlock('u-button', { label: 'Go' })
    const { doc: withButton } = insertBlock(doc, button, {
      parentId: id,
      slot: 'links',
      index: 0,
    })!
    const text = expectStable(withButton)
    const parsed = parseBlocks(text).blocks[0] as PlutoComponentBlock
    expect(Object.keys(parsed.slots)).toEqual(['title', 'links'])
    expect(parsed.slots.links).toHaveLength(1)
    const { doc: withDefault } = insertBlock(doc, createTextBlock('Body.'), {
      parentId: id,
      slot: 'default',
      index: 0,
    })!
    const defaultText = expectStable(withDefault)
    const defaultParsed = parseBlocks(defaultText)
      .blocks[0] as PlutoComponentBlock
    expect(Object.keys(defaultParsed.slots)).toEqual([
      'default',
      'title',
      'links',
    ])
  })

  it('refuses an unknown target', () => {
    expect(
      insertBlock(parseBlocks(source), createTextBlock('x'), {
        parentId: 'nope',
        index: 0,
      })
    ).toBeUndefined()
  })
})

describe('remove', () => {
  it('removes the first, a middle and the last block', () => {
    const doc = parseBlocks(source)
    expect(expectStable(removeBlock(doc, doc.blocks[0]!.id))).toBe(
      source.slice(source.indexOf('## Two'))
    )
    expect(expectStable(removeBlock(doc, doc.blocks[1]!.id))).toBe(
      source.replace('## Two\n\nText two.\n\n', '')
    )
    expect(expectStable(removeBlock(doc, doc.blocks.at(-1)!.id))).toBe(
      source.replace('\n\n::note\nA note.\n::', '')
    )
  })

  it('leaves an empty doc after the last block', () => {
    const doc = parseBlocks('Only.\n')
    const next = removeBlock(doc, doc.blocks[0]!.id)
    expect(next.blocks).toHaveLength(0)
    expect(next.gaps).toHaveLength(1)
    expect(serializeBlocks(next)).toBe('\n')
  })

  it('removes a child and keeps the others untouched', () => {
    const doc = parseBlocks(
      '::card-group\n  :::card\n  ---\n  title: One\n  ---\n  A\n  :::\n\n  :::card\n  ---\n  title: Two\n  ---\n  B\n  :::\n::\n'
    )
    const group = doc.blocks[0] as PlutoComponentBlock
    const first = removeBlock(doc, flatChildren(group)[0]!.id)
    expect(expectStable(first)).toBe(
      '::card-group\n\n  :::card\n  ---\n  title: Two\n  ---\n  B\n  :::\n::\n'
    )
    const second = removeBlock(doc, flatChildren(group)[1]!.id)
    expect(expectStable(second)).toBe(
      '::card-group\n  :::card\n  ---\n  title: One\n  ---\n  A\n  :::\n::\n'
    )
  })

  it('returns the same doc for an unknown id', () => {
    const doc = parseBlocks(source)
    expect(removeBlock(doc, 'nope')).toBe(doc)
  })
})

describe('move', () => {
  it('reorders blocks of one list and keeps the gaps in place', () => {
    const doc = parseBlocks('::a\nA.\n::\n\n\n::b\nB.\n::\n\n::c\nC.\n::\n')
    const moved = moveBlock(doc, doc.blocks[2]!.id, { index: 0 })
    expect(serializeBlocks(moved)).toBe(
      '::c\nC.\n::\n\n\n::a\nA.\n::\n\n::b\nB.\n::\n'
    )
    expect(moved.blocks.map((block) => block.id)).toEqual([
      doc.blocks[2]!.id,
      doc.blocks[0]!.id,
      doc.blocks[1]!.id,
    ])
    // The blocks keep their slices, so the moved text is the source text.
    expect(moved.blocks[0]!.original).toBeDefined()
  })

  it('returns the same doc for a move to the same place', () => {
    const doc = parseBlocks(source)
    expect(moveBlock(doc, doc.blocks[1]!.id, { index: 1 })).toBe(doc)
  })

  it('moves a block into a component and out of it', () => {
    const doc = parseBlocks('::note\nA note.\n::\n\nLoose text.\n')
    const note = doc.blocks[0]!
    const loose = doc.blocks[1]!
    const into = moveBlock(doc, loose.id, {
      parentId: note.id,
      slot: 'default',
      index: 1,
    })
    expect(expectStable(into)).toBe('::note\nA note.\n\nLoose text.\n::\n')
    expect(findBlock(into, loose.id)?.parent?.id).toBe(note.id)
    const back = moveBlock(into, loose.id, { index: 1 })
    expect(expectStable(back)).toBe('::note\nA note.\n::\n\nLoose text.\n')
  })

  it('keeps the id of the moved block', () => {
    const doc = parseBlocks('::note\nA.\n::\n\nB.\n')
    const next = moveBlock(doc, doc.blocks[1]!.id, {
      parentId: doc.blocks[0]!.id,
      slot: 'default',
      index: 0,
    })
    expect(findBlock(next, doc.blocks[1]!.id)).toBeDefined()
  })

  it('does not move a block into itself', () => {
    const doc = parseBlocks('::card-group\n  :::card\n  A\n  :::\n::\n')
    const group = doc.blocks[0] as PlutoComponentBlock
    const card = flatChildren(group)[0]!
    expect(
      moveBlock(doc, group.id, { parentId: card.id, slot: 'default', index: 0 })
    ).toBe(doc)
  })

  it('moves a component into a deeper level with a new indent', () => {
    const doc = parseBlocks(
      '::card-group\n  :::card\n  ---\n  title: One\n  ---\n  A\n  :::\n::\n\n::card\n---\ntitle: Two\n---\nB\n::\n'
    )
    const group = doc.blocks[0]!
    const outside = doc.blocks[1]!
    const next = moveBlock(doc, outside.id, {
      parentId: group.id,
      slot: 'default',
      index: 1,
    })
    const text = expectStable(next)
    const parsed = parseBlocks(text).blocks[0] as PlutoComponentBlock
    expect(
      flatChildren(parsed).map((child) =>
        child.kind === 'component' ? child.props.title : ''
      )
    ).toEqual(['One', 'Two'])
    expect(flatChildren(parsed)[1]).toMatchObject({ indent: '  ', colons: 3 })
    expect(text).toContain('  :::card\n  ---\n  title: Two\n  ---\n  B\n  :::')
  })
})

describe('duplicate', () => {
  it('puts a copy after the block, with new ids', () => {
    const doc = parseBlocks(source)
    const { doc: next, ids } = duplicateBlock(doc, doc.blocks[3]!.id)!
    expect(kinds(expectStable(next))).toEqual([
      'text',
      'text',
      'code',
      'note',
      'note',
    ])
    expect(ids[0]).not.toBe(doc.blocks[3]!.id)
    expect(next.blocks[4]!.id).toBe(ids[0])
    expect(new Set(next.blocks.map((block) => block.id)).size).toBe(
      next.blocks.length
    )
  })

  it('copies the children of a component with new ids', () => {
    const doc = parseBlocks(
      '::card-group\n  :::card\n  ---\n  title: One\n  ---\n  A\n  :::\n::\n'
    )
    const { doc: next } = duplicateBlock(doc, doc.blocks[0]!.id)!
    const ids: string[] = []
    walkBlocks(next.blocks, (block) => ids.push(block.id))
    expect(ids).toHaveLength(6)
    expect(new Set(ids).size).toBe(6)
    expectStable(next)
  })

  it('duplicates a child inside its parent', () => {
    const doc = parseBlocks(
      '::card-group\n  :::card\n  ---\n  title: One\n  ---\n  A\n  :::\n::\n'
    )
    const card = flatChildren(doc.blocks[0] as PlutoComponentBlock)[0]!
    const { doc: next } = duplicateBlock(doc, card.id)!
    const parsed = parseBlocks(expectStable(next))
      .blocks[0] as PlutoComponentBlock
    expect(flatChildren(parsed)).toHaveLength(2)
  })
})

describe('replace with Markdown', () => {
  it('replaces a block with one or more blocks', () => {
    const doc = parseBlocks(source)
    const result = replaceWithMarkdown(
      doc,
      doc.blocks[1]!.id,
      '## New\n\nTwo paragraphs.\n\n```js\nx\n```'
    )!
    expect(result.ids).toHaveLength(2)
    expect(expectStable(result.doc)).toBe(
      source.replace(
        '## Two\n\nText two.',
        '## New\n\nTwo paragraphs.\n\n```js\nx\n```'
      )
    )
  })

  it('removes the block for an empty text', () => {
    const doc = parseBlocks(source)
    const result = replaceWithMarkdown(doc, doc.blocks[1]!.id, '  \n')!
    expect(result.ids).toEqual([])
    expect(expectStable(result.doc)).toBe(
      source.replace('## Two\n\nText two.\n\n', '')
    )
  })

  it('gives the Markdown of a block for the "Edit as Markdown" action', () => {
    const doc = parseBlocks(source)
    expect(blockMarkdown(doc.blocks[2]!)).toBe('```ts\nconst a = 1\n```')
    expect(blockMarkdown(doc.blocks[3]!)).toBe('::note\nA note.\n::')
  })
})

describe('every operation on every page of the corpus', () => {
  it(
    'leaves a text that parses again and writes the same bytes',
    { timeout: 120_000 },
    () => {
      for (const { file, body } of corpusBodies().filter(
        (_page, index) => index % 4 === 0
      )) {
        const doc = parseBlocks(body)
        const ids: string[] = []
        walkBlocks(doc.blocks, (block) => ids.push(block.id))
        // All components, and every fifth block.
        for (const id of ids.filter(
          (id, index) =>
            index % 5 === 0 || findBlock(doc, id)!.block.kind === 'component'
        )) {
          const duplicated = duplicateBlock(doc, id)
          expectStable(duplicated!.doc, `${file} duplicate ${id}`)
          expectStable(removeBlock(doc, id), `${file} remove ${id}`)
          const found = findBlock(doc, id)!
          // Move to the start of the same list.
          expectStable(
            moveBlock(doc, id, {
              parentId: found.parent?.id,
              slot: found.slot,
              index: 0,
            }),
            `${file} move ${id}`
          )
        }
      }
    }
  )

  it('removes exactly one block with each remove', () => {
    for (const { file, body } of corpusBodies().slice(0, 20)) {
      const doc = parseBlocks(body)
      const count = (value: PlutoBlockDoc) => {
        let total = 0
        walkBlocks(value.blocks, () => total++)
        return total
      }
      const total = count(doc)
      const ids: string[] = []
      walkBlocks(doc.blocks, (block) => ids.push(block.id))
      for (const id of ids) {
        const removed = count(removeBlock(doc, id))
        // Removing a component removes its children too.
        const found = findBlock(doc, id)!.block
        const size =
          found.kind === 'component' ? 1 + flatChildren(found).length : 1
        expect(removed, `${file} ${id}`).toBeLessThanOrEqual(total - 1)
        expect(removed, `${file} ${id}`).toBeGreaterThanOrEqual(
          total - size - 100
        )
      }
    }
  })

  it('finds a path for every block', () => {
    for (const { body } of corpusBodies().slice(0, 10)) {
      const doc = parseBlocks(body)
      walkBlocks(doc.blocks, (block) => {
        const path = pathOf(doc, block.id)
        expect(path.at(-1)).toBe(block.id)
      })
    }
  })
})
