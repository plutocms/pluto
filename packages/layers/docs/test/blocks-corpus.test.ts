import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseBlocks } from '../shared/utils/blocks/parse'
import { serializeBlocks } from '../shared/utils/blocks/serialize'
import { walkBlocks } from '../shared/utils/blocks/tree'
import { corpusBodies, corpusFiles } from './helpers/corpus'

// The 48 pages of the docs site, copied as they are. The editor must write
// each page back with the same bytes when nothing changed. This test guards
// the splice model: if it fails, a page would show a diff after a save with no edit.

describe('block model corpus', () => {
  it('has the 48 pages of the docs site', () => {
    expect(corpusFiles()).toHaveLength(48)
  })

  it('writes every body back byte for byte (48 of 48)', () => {
    const failed = corpusBodies()
      .filter(({ body }) => serializeBlocks(parseBlocks(body)) !== body)
      .map(({ file }) => file)
    expect(failed).toEqual([])
  })

  it('writes every whole file back byte for byte', () => {
    for (const file of corpusFiles()) {
      const text = readFileSync(file, 'utf8')
      expect(serializeBlocks(parseBlocks(text))).toBe(text)
    }
  })

  it('gives every block a slice that matches the source', () => {
    for (const { body } of corpusBodies()) {
      walkBlocks(parseBlocks(body).blocks, (block) => {
        expect(block.original, block.id).toBeDefined()
        expect(body.slice(block.original!.start, block.original!.end)).toBe(
          block.original!.text
        )
      })
    }
  })

  it('keeps the blocks of every page in source order, with the gaps between them', () => {
    for (const { body } of corpusBodies()) {
      const doc = parseBlocks(body)
      expect(doc.gaps).toHaveLength(doc.blocks.length + 1)
      let cursor = 0
      for (const [index, block] of doc.blocks.entries()) {
        expect(block.original!.start).toBe(cursor + doc.gaps[index]!.length)
        cursor = block.original!.end
      }
    }
  })

  it('writes the same bytes when the page has Windows line ends', () => {
    for (const { body } of corpusBodies().slice(0, 12)) {
      const crlf = body.replaceAll('\n', '\r\n')
      expect(serializeBlocks(parseBlocks(crlf))).toBe(crlf)
    }
  })
})
