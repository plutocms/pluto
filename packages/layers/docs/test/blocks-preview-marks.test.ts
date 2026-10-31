import type { PlutoMarkNode } from '../shared/utils/blocks/preview-marks'
import type { PlutoPreviewChild } from '../shared/utils/blocks/preview-protocol'
import type { PlutoComponentBlock } from '../shared/utils/blocks/types'
import { parseMarkdown } from '@nuxtjs/mdc/runtime'
import { describe, expect, it } from 'vitest'
import {
  previewSelectionId,
  toPreviewBlocks,
} from '../shared/utils/blocks/editor'
import { parseBlocks } from '../shared/utils/blocks/parse'
import {
  countPreviewChildren,
  markPreviewChildren,
  PREVIEW_BLOCK_ATTRIBUTE,
  previewParents,
} from '../shared/utils/blocks/preview-marks'
import {
  parsePreviewMessage,
  previewMessage,
} from '../shared/utils/blocks/preview-protocol'
import { flatChildren } from '../shared/utils/blocks/tree'
import { corpusBodies } from './helpers/corpus'

// The preview marks the inner components of a block, so a click selects the
// card, not the whole card group. The marks follow the site parser
// (`parseMarkdown` of @nuxtjs/mdc), as the preview page does.

async function parse(markdown: string): Promise<PlutoMarkNode[]> {
  const { body } = await parseMarkdown(markdown, { highlight: false })
  return (body.children as PlutoMarkNode[]).filter(
    (node) => node.type === 'element'
  )
}

/** The marked ids under a node, in document order. */
function markedIds(node: PlutoMarkNode, ids: string[] = []): string[] {
  for (const child of node.children ?? []) {
    const id = child.props?.[PREVIEW_BLOCK_ATTRIBUTE]
    if (typeof id === 'string') {
      ids.push(id)
    }
    markedIds(child, ids)
  }
  return ids
}

const SECTION = `::u-page-section
#title
Hello

#features
  :::u-page-feature{icon="i-lucide-x"}
  #title
  A
  :::

  :::u-page-feature
  ---
  icon: i-lucide-y
  ---
  B
  :::
::`

describe('markPreviewChildren', () => {
  it('marks the components of the named slots', async () => {
    const [section] = await parse(SECTION)
    const children: PlutoPreviewChild[] = [
      { id: 'f1', name: 'u-page-feature' },
      { id: 'f2', name: 'u-page-feature' },
    ]
    expect(markPreviewChildren(section!, children)).toBe(2)
    expect(markedIds(section!)).toEqual(['f1', 'f2'])
  })

  it('marks nested components, and skips an inline component in a paragraph', async () => {
    const [group] = await parse(`::card-group
  :::card{title="One"}
  Press :card{title="inline"} here
  :::
  :::card{title="Two"}
  ::::note
  Inner
  ::::
  :::
::`)
    const children: PlutoPreviewChild[] = [
      { id: 'c1', name: 'card' },
      { id: 'c2', name: 'card', children: [{ id: 'n1', name: 'note' }] },
    ]
    expect(markPreviewChildren(group!, children)).toBe(3)
    expect(markedIds(group!)).toEqual(['c1', 'c2', 'n1'])
  })

  it('matches a PascalCase tag to a kebab-case name', () => {
    const node: PlutoMarkNode = {
      type: 'element',
      tag: 'card-group',
      children: [{ type: 'element', tag: 'UPageCard' }],
    }
    expect(markPreviewChildren(node, [{ id: 'x', name: 'u-page-card' }])).toBe(
      1
    )
  })

  it('stops at a child that has no element', async () => {
    const [section] = await parse(SECTION)
    expect(markPreviewChildren(section!, [{ id: 'c', name: 'card' }])).toBe(0)
  })
})

describe('the corpus', () => {
  it('marks every inner component of the 48 docs pages', async () => {
    const missing: string[] = []
    let total = 0
    for (const { file, body } of corpusBodies()) {
      for (const block of toPreviewBlocks(parseBlocks(body).blocks)) {
        if (!block.children) {
          continue
        }
        const expected = countPreviewChildren(block.children)
        total += expected
        let marked = 0
        for (const element of await parse(block.markdown)) {
          marked += markPreviewChildren(element, block.children)
        }
        if (marked !== expected) {
          missing.push(`${file}: ${marked} of ${expected}`)
        }
      }
    }
    expect(missing).toEqual([])
    expect(total).toBeGreaterThan(20)
  })
})

describe('previewParents', () => {
  it('maps each child to its parent', () => {
    const parents = previewParents('top', [
      { id: 'a', name: 'card', children: [{ id: 'b', name: 'note' }] },
    ])
    expect(parents.get('a')).toBe('top')
    expect(parents.get('b')).toBe('a')
  })
})

describe('previewSelectionId', () => {
  it('gives the deepest component on the path', () => {
    const doc = parseBlocks(
      'Intro\n\n::card-group\n  :::card{title="One"}\n  Text in the card\n  :::\n::\n'
    )
    const group = doc.blocks.find(
      (block): block is PlutoComponentBlock => block.kind === 'component'
    )!
    const card = flatChildren(group).find(
      (block): block is PlutoComponentBlock => block.kind === 'component'
    )!
    const text = flatChildren(card)[0]!

    expect(previewSelectionId(doc, text.id)).toBe(card.id)
    expect(previewSelectionId(doc, card.id)).toBe(card.id)
    expect(previewSelectionId(doc, group.id)).toBe(group.id)
    expect(previewSelectionId(doc, doc.blocks[0]!.id)).toBe(doc.blocks[0]!.id)
    expect(previewSelectionId(doc, null)).toBeNull()
  })
})

describe('the protocol with inner components', () => {
  const render = (children: unknown) => ({
    ...previewMessage('render', { frontmatter: {}, blocks: [] }),
    blocks: [{ id: 'a', markdown: '::card-group\n::', children }],
  })

  it('accepts a tree of children', () => {
    expect(
      parsePreviewMessage(
        render([
          {
            id: 'b',
            name: 'card',
            label: 'Card',
            children: [{ id: 'c', name: 'note' }],
          },
        ]),
        'to-frame'
      )
    ).toBeDefined()
  })

  it('rejects a wrong child', () => {
    expect(
      parsePreviewMessage(render([{ id: 'b' }]), 'to-frame')
    ).toBeUndefined()
    expect(parsePreviewMessage(render('cards'), 'to-frame')).toBeUndefined()
  })

  it('rejects a tree that nests without end', () => {
    let deep: unknown = []
    for (let level = 0; level < 40; level++) {
      deep = [{ id: `x${level}`, name: 'card', children: deep }]
    }
    expect(parsePreviewMessage(render(deep), 'to-frame')).toBeUndefined()
  })
})
