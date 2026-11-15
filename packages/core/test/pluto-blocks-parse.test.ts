import type { ElementNode, Node } from 'comark'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearPlutoBlocksCache,
  parsePlutoBlocks,
  PLUTO_BLOCKS_CACHE_LIMIT,
} from '../server/utils/pluto-blocks'

function walk(nodes: Node[], visit: (node: ElementNode) => void) {
  for (const node of nodes) {
    if (Array.isArray(node) && typeof node[0] === 'string') {
      visit(node as ElementNode)
      walk(node.slice(2) as Node[], visit)
    }
  }
}

function tags(nodes: Node[]): string[] {
  const found: string[] = []
  walk(nodes, (node) => found.push(node[0]))
  return found
}

beforeEach(() => {
  clearPlutoBlocksCache()
})

describe('parsePlutoBlocks', () => {
  it('removes script and iframe', async () => {
    const document = await parsePlutoBlocks(
      [
        '<script>alert(1)</script>',
        '',
        '<iframe src="https://example.com"></iframe>',
        '',
        'Text after.',
      ].join('\n')
    )

    const found = tags(document.nodes)
    expect(found).not.toContain('script')
    expect(found).not.toContain('iframe')
    expect(JSON.stringify(document.nodes)).toContain('Text after.')
  })

  it('removes a form and its controls', async () => {
    const document = await parsePlutoBlocks(
      '<form action="/x"><input name="a"><button>Go</button></form>'
    )

    const found = tags(document.nodes)
    for (const tag of ['form', 'input', 'button']) {
      expect(found).not.toContain(tag)
    }
  })

  it('removes an event handler', async () => {
    const document = await parsePlutoBlocks('<div onclick="alert(1)">Hi</div>')

    expect(JSON.stringify(document.nodes)).not.toContain('onclick')
    expect(JSON.stringify(document.nodes)).toContain('Hi')
  })

  it('removes a javascript: link and keeps a safe one', async () => {
    const document = await parsePlutoBlocks(
      [
        '[bad](javascript:void) [good](https://example.com) [local](/about)',
        '',
        '<a href="javascript:alert(1)">raw</a>',
      ].join('\n')
    )

    const hrefs: unknown[] = []
    walk(document.nodes, (node) => {
      if (node[0] === 'a') {
        hrefs.push(node[1].href)
      }
    })
    expect(hrefs).toEqual(['https://example.com', '/about', undefined])
  })

  it('removes a javascript: URL from a component prop', async () => {
    const document = await parsePlutoBlocks(
      '::card{href="javascript:alert(1)" title="Card"}\n::'
    )

    const card = document.nodes[0] as ElementNode
    expect(card[1]).toEqual({ title: 'Card' })
  })

  it('removes a protocol that is not allowed', async () => {
    const document = await parsePlutoBlocks('[ftp](ftp://example.com/file)')

    expect(JSON.stringify(document.nodes)).not.toContain('ftp://')
  })

  it('keeps a nested component with a slot and YAML props', async () => {
    const document = await parsePlutoBlocks(
      [
        '::outer',
        '---',
        'title: Outer',
        'count: 2',
        '---',
        '#header',
        'Head text',
        '',
        ':::inner{tone="warm"}',
        'Inner text',
        ':::',
        '::',
      ].join('\n')
    )

    const outer = document.nodes[0] as ElementNode
    expect(outer[0]).toBe('outer')
    expect(outer[1]).toMatchObject({ title: 'Outer' })
    const found = tags(document.nodes)
    expect(found).toContain('template')
    expect(found).toContain('inner')
    const json = JSON.stringify(document.nodes)
    expect(json).toContain('Inner text')
    expect(json).toContain('Head text')
    expect(json).toContain('"tone":"warm"')
  })

  it('returns the cached document for the same text', async () => {
    const first = await parsePlutoBlocks('Same text')
    const second = await parsePlutoBlocks('Same text')

    expect(second).toBe(first)
    expect(await parsePlutoBlocks('Other text')).not.toBe(first)
  })

  it('drops the oldest entry over the limit', async () => {
    const first = await parsePlutoBlocks('text 0')
    for (let index = 1; index <= PLUTO_BLOCKS_CACHE_LIMIT; index++) {
      await parsePlutoBlocks(`text ${index}`)
    }

    expect(await parsePlutoBlocks('text 0')).not.toBe(first)
  })
})
