import type {
  PlutoBlock,
  PlutoComponentBlock,
} from '../shared/utils/blocks/types'
import { describe, expect, it } from 'vitest'
import {
  removeBlock,
  setProp,
  setSlot,
  updateCode,
  updateText,
} from '../shared/utils/blocks/operations'
import { parseBlocks } from '../shared/utils/blocks/parse'
import { serializeBlocks } from '../shared/utils/blocks/serialize'
import { flatChildren, walkBlocks } from '../shared/utils/blocks/tree'
import { corpusBodies } from './helpers/corpus'

// One edit changes only the lines of the edited block. The text before the
// block and the text after it stay the same, byte for byte.

function allBlocks(body: string): PlutoBlock[] {
  const out: PlutoBlock[] = []
  walkBlocks(parseBlocks(body).blocks, (block) => out.push(block))
  return out
}

/** The count of lines of `after` that differ from `before`, between the common start and the common end. */
function changedLines(before: string, after: string): number {
  const a = before.split('\n')
  const b = after.split('\n')
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) {
    start++
  }
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }
  return Math.max(endA - start, endB - start)
}

describe('edit of a Text block', () => {
  const source =
    '# Title\n\nFirst text.\n\n## Part\n\nSecond text.\n\n```ts\nconst a = 1\n```\n\nThird text.\n'

  it('changes only the lines of that block', () => {
    const doc = parseBlocks(source)
    const second = doc.blocks[1]!
    expect(second.kind).toBe('text')
    const next = updateText(doc, second.id, '## Part\n\nSecond text, changed.')
    expect(serializeBlocks(next)).toBe(
      source.replace('Second text.', 'Second text, changed.')
    )
    // The other blocks keep their slices.
    expect(next.blocks[0]!.original).toBeDefined()
    expect(next.blocks[2]!.original).toBeDefined()
    expect(next.blocks[1]!.original).toBeUndefined()
  })

  it('does not change the input doc', () => {
    const doc = parseBlocks(source)
    const copy = JSON.stringify(doc)
    updateText(doc, doc.blocks[0]!.id, 'Other')
    expect(JSON.stringify(doc)).toBe(copy)
  })

  it('returns the same doc for the same text', () => {
    const doc = parseBlocks(source)
    const first = doc.blocks[0]! as Extract<PlutoBlock, { kind: 'text' }>
    expect(updateText(doc, first.id, first.markdown)).toBe(doc)
  })

  it('changes only one block on every page of the corpus', () => {
    for (const { file, body } of corpusBodies()) {
      const doc = parseBlocks(body)
      for (const block of doc.blocks) {
        if (block.kind !== 'text') {
          continue
        }
        const added = `${block.markdown}\n\nAdded paragraph.`
        const out = serializeBlocks(updateText(doc, block.id, added))
        const { start, end } = block.original!
        expect(out.startsWith(body.slice(0, start)), file).toBe(true)
        expect(out.endsWith(body.slice(end)), file).toBe(true)
        expect(out.slice(start, out.length - (body.length - end))).toBe(added)
      }
    }
  })
})

describe('edit of a Code block', () => {
  it('keeps the fence and changes the code', () => {
    const source = 'Text.\n\n```ts [file.ts]\nconst a = 1\n```\n\nEnd.\n'
    const doc = parseBlocks(source)
    const code = doc.blocks[1]!
    expect(code).toMatchObject({
      kind: 'code',
      lang: 'ts',
      filename: 'file.ts',
      code: 'const a = 1',
    })
    expect(
      serializeBlocks(updateCode(doc, code.id, { code: 'const a = 2' }))
    ).toBe(source.replace('a = 1', 'a = 2'))
    expect(
      serializeBlocks(
        updateCode(doc, code.id, { filename: 'other.ts', lang: 'js' })
      )
    ).toBe(source.replace('ts [file.ts]', 'js [other.ts]'))
  })

  it('uses a longer fence when the code holds a fence', () => {
    const doc = parseBlocks('```md\nx\n```\n')
    const out = serializeBlocks(
      updateCode(doc, doc.blocks[0]!.id, { code: 'a\n```\nb' })
    )
    expect(out).toBe('````md\na\n```\nb\n````\n')
  })
})

describe('edit of a prop', () => {
  const source = [
    'Intro.',
    '',
    '::note{icon="i-lucide-info" .wide}',
    'Text of the note.',
    '::',
    '',
    '::card-group',
    '  :::card',
    '  ---',
    '  title: One',
    '  icon: i-lucide-box',
    '  to: /one',
    '  ---',
    '  Text of one.',
    '  :::',
    '',
    '  :::card',
    '  ---',
    '  title: Two',
    '  ---',
    '  Text of two.',
    '  :::',
    '::',
    '',
  ].join('\n')

  it('changes only the opening line of an inline component', () => {
    const doc = parseBlocks(source)
    const note = doc.blocks[1]!
    expect(note).toMatchObject({
      kind: 'component',
      name: 'note',
      props: { icon: 'i-lucide-info', class: 'wide' },
      propsStyle: 'inline',
    })
    const out = serializeBlocks(setProp(doc, note.id, 'icon', 'i-lucide-star'))
    expect(out).toBe(
      source.replace('icon="i-lucide-info"', 'icon="i-lucide-star"')
    )
  })

  it('adds a prop at the end and removes a prop', () => {
    const doc = parseBlocks(source)
    const note = doc.blocks[1]!
    expect(serializeBlocks(setProp(doc, note.id, 'to', '/docs'))).toBe(
      source.replace('.wide}', '.wide to="/docs"}')
    )
    expect(serializeBlocks(setProp(doc, note.id, 'icon', undefined))).toBe(
      source.replace('icon="i-lucide-info" ', '')
    )
  })

  it('writes boolean and bound values', () => {
    const doc = parseBlocks('::note\nText.\n::\n')
    const id = doc.blocks[0]!.id
    expect(serializeBlocks(setProp(doc, id, 'open', true))).toBe(
      '::note{open}\nText.\n::\n'
    )
    expect(serializeBlocks(setProp(doc, id, 'cols', 3))).toBe(
      "::note{:cols='3'}\nText.\n::\n"
    )
    expect(serializeBlocks(setProp(doc, id, 'title', 'Say "hi"'))).toBe(
      '::note{title=\'Say "hi"\'}\nText.\n::\n'
    )
  })

  it('changes only one entry of a YAML block, inside a nested component', () => {
    const doc = parseBlocks(source)
    const group = doc.blocks[2] as PlutoComponentBlock
    expect(group.kind).toBe('component')
    const card = flatChildren(group)[0]!
    expect(card).toMatchObject({
      kind: 'component',
      name: 'card',
      propsStyle: 'yaml',
      props: { title: 'One', icon: 'i-lucide-box', to: '/one' },
    })
    const out = serializeBlocks(setProp(doc, card.id, 'title', 'First'))
    expect(out).toBe(source.replace('title: One', 'title: First'))
    expect(changedLines(source, out)).toBe(1)
    // A new key goes at the end of the YAML block.
    const added = serializeBlocks(setProp(doc, card.id, 'color', 'primary'))
    expect(added).toBe(
      source.replace('  to: /one\n', '  to: /one\n  color: primary\n')
    )
  })

  it('keeps the other children of a component untouched', () => {
    const doc = parseBlocks(source)
    const group = doc.blocks[2] as PlutoComponentBlock
    const next = setProp(doc, flatChildren(group)[0]!.id, 'title', 'First')
    const nextGroup = next.blocks[2] as PlutoComponentBlock
    expect(nextGroup.original).toBeUndefined()
    expect(flatChildren(nextGroup)[1]!.original).toBeDefined()
    expect(next.blocks[0]!.original).toBeDefined()
    expect(next.blocks[1]!.original).toBeDefined()
  })

  it('writes the same bytes when a prop is set to its own value, on every component of the corpus', () => {
    for (const { file, body } of corpusBodies()) {
      for (const block of allBlocks(body)) {
        if (block.kind !== 'component') {
          continue
        }
        const [key] = block.propOrder
        if (key === undefined) {
          continue
        }
        expect(
          serializeBlocks(
            setProp(parseBlocks(body), block.id, key, block.props[key])
          ),
          file
        ).toBe(body)
      }
    }
  })

  it('changes at most the opener on every component of the corpus', () => {
    for (const { file, body } of corpusBodies()) {
      for (const block of allBlocks(body)) {
        if (block.kind !== 'component') {
          continue
        }
        const out = serializeBlocks(
          setProp(parseBlocks(body), block.id, 'data-test', 'x')
        )
        expect(
          changedLines(body, out),
          `${file} ${block.name}`
        ).toBeLessThanOrEqual(1)
        expect(out.length, file).toBeGreaterThan(body.length)
      }
    }
  })
})

describe('edit of a slot', () => {
  const source =
    '::u-page-section\n#title\nOld title\n\n#description\nOld text.\n::\n'

  it('changes only the content of that slot', () => {
    const doc = parseBlocks(source)
    const section = doc.blocks[0] as PlutoComponentBlock
    expect(section).toMatchObject({ kind: 'component', name: 'u-page-section' })
    expect(Object.keys(section.slots)).toEqual(['title', 'description'])
    expect(
      serializeBlocks(setSlot(doc, section.id, 'title', 'New title'))
    ).toBe(source.replace('Old title', 'New title'))
    expect(
      serializeBlocks(
        setSlot(doc, section.id, 'description', 'First.\n\nSecond.')
      )
    ).toBe(source.replace('Old text.', 'First.\n\nSecond.'))
  })

  it('empties a slot and fills it again', () => {
    const doc = parseBlocks(source)
    const id = doc.blocks[0]!.id
    const empty = setSlot(doc, id, 'title', '')
    expect(serializeBlocks(empty)).toBe(
      '::u-page-section\n#title\n\n#description\nOld text.\n::\n'
    )
    const again = setSlot(empty, id, 'title', 'Back')
    expect(serializeBlocks(again)).toBe(
      '::u-page-section\n#title\nBack\n\n#description\nOld text.\n::\n'
    )
  })

  it('adds a slot that the component does not have', () => {
    const doc = parseBlocks('::note\nText.\n::\n')
    const out = serializeBlocks(
      setSlot(doc, doc.blocks[0]!.id, 'title', 'Heading')
    )
    expect(out).toBe('::note\nText.\n#title\nHeading\n::\n')
    const parsed = parseBlocks(out).blocks[0] as PlutoComponentBlock
    expect(Object.keys(parsed.slots)).toEqual(['default', 'title'])
  })

  it('fills the default slot of an empty component', () => {
    const doc = parseBlocks('::note\n::\n')
    expect(
      serializeBlocks(
        setSlot(doc, doc.blocks[0]!.id, 'default', 'Now with text.')
      )
    ).toBe('::note\nNow with text.\n::\n')
  })

  it('removes the last child without losing the slot lines', () => {
    const doc = parseBlocks(source)
    const section = doc.blocks[0] as PlutoComponentBlock
    const out = serializeBlocks(removeBlock(doc, section.slots.title![0]!.id))
    expect(out).toBe(
      '::u-page-section\n#title\n\n#description\nOld text.\n::\n'
    )
  })
})
