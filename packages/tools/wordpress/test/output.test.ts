import type {
  PlutoBlock,
  PlutoComponentBlock,
} from '../../../core/shared/utils/blocks/types'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { parseBlocks } from '../../../core/shared/utils/blocks/parse'
import { parseMarkdownFile } from '../src/files'
import { runImport } from '../src/import'
import { PNG, SITE } from './fixtures'

const KIT = join(
  import.meta.dirname,
  '../../../layers/addons/blocks/app/components/content'
)

const kebab = (name: string) =>
  name.replace(/([a-z\d])([A-Z])/g, '$1-$2').toLowerCase()

const camel = (name: string) =>
  name.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())

async function kitBlocks(): Promise<Map<string, Set<string>>> {
  const blocks = new Map<string, Set<string>>()

  for (const file of await readdir(KIT)) {
    if (!/^Block[A-Z]\w*\.vue$/.test(file)) {
      continue
    }

    const source = await readFile(join(KIT, file), 'utf8')
    const body = /interface Props \{([\s\S]*?)\n\}/.exec(source)?.[1] ?? ''
    const props = [...body.matchAll(/^ {2}(\w+)\??:/gm)].map(
      (match) => match[1]!
    )

    blocks.set(kebab(file.replace('.vue', '')), new Set(props))
  }

  return blocks
}

function walk(blocks: PlutoBlock[], visit: (block: PlutoBlock) => void) {
  for (const block of blocks) {
    visit(block)

    if (block.kind === 'component') {
      for (const slot of Object.values(block.slots)) {
        walk(slot, visit)
      }
    }
  }
}

let root: string
let kit: Map<string, Set<string>>
let bodies: Record<string, string>

beforeAll(async () => {
  kit = await kitBlocks()
  root = await mkdtemp(join(tmpdir(), 'pluto-wordpress-output-'))

  const input = join(root, 'export.xml')

  await writeFile(input, SITE)
  await runImport({
    input,
    out: join(root, 'project'),
    now: () => new Date('2026-11-16T10:00:00Z'),
    fetch: (() =>
      Promise.resolve(
        new Response(PNG, { headers: { 'content-type': 'image/png' } })
      )) as typeof fetch,
  })

  bodies = {}

  for (const name of ['home', 'about', 'about/our-team']) {
    const text = await readFile(
      join(root, 'project/content/pages', `${name}.md`),
      'utf8'
    )

    bodies[name] = parseMarkdownFile(text).body
  }
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('the kit', () => {
  it('has the 22 blocks of the landing kit', () => {
    expect(kit.size).toBe(22)
    expect(kit.has('block-section')).toBe(true)
    expect(kit.has('block-accordion-item')).toBe(true)
  })
})

describe('the generated pages parse with the block parser of core', () => {
  it('has only blocks of the kit, with props that the blocks declare', () => {
    for (const body of Object.values(bodies)) {
      const names: string[] = []

      walk(parseBlocks(body).blocks, (block) => {
        if (block.kind !== 'component') {
          return
        }

        names.push(block.name)
        expect(kit.has(block.name), `${block.name} is a block of the kit`).toBe(
          true
        )

        for (const key of block.propOrder) {
          expect(
            kit.get(block.name)!.has(camel(key)),
            `${block.name} declares the prop ${key}`
          ).toBe(true)
        }
      })

      expect(names.length).toBeGreaterThan(0)
    }
  })

  it('has no block of the kit that fell back to raw text', () => {
    for (const body of Object.values(bodies)) {
      const written = [...body.matchAll(/^:{2,}(block-[\w-]+)/gm)].length
      let parsed = 0

      walk(parseBlocks(body).blocks, (block) => {
        if (block.kind === 'component') {
          parsed++
        }

        if (block.kind === 'raw') {
          expect(block.reason).toBe('html')
        }
      })

      expect(parsed).toBe(written)
    }
  })

  it('has only sections at the top level', () => {
    for (const body of Object.values(bodies)) {
      const { blocks } = parseBlocks(body)

      expect(blocks.length).toBeGreaterThan(0)
      expect(
        blocks.every(
          (block) =>
            block.kind === 'component' && block.name === 'block-section'
        )
      ).toBe(true)
    }
  })

  it('nests the layout: sections hold columns, columns hold widgets', () => {
    const [section] = parseBlocks(bodies.home!).blocks as PlutoComponentBlock[]
    const second = (
      parseBlocks(bodies.home!).blocks as PlutoComponentBlock[]
    )[1]!
    const columns = second.slots.default![0] as PlutoComponentBlock
    const column = columns.slots.default![1] as PlutoComponentBlock

    expect(section!.name).toBe('block-section')
    expect(columns.name).toBe('block-columns')
    expect(column.name).toBe('block-column')
    expect(
      (column.slots.default as PlutoComponentBlock[]).map((block) => block.name)
    ).toEqual(['block-heading', 'block-icon-box'])
  })

  it('uses every block that the importer maps, in the home page', () => {
    const used = new Set<string>()

    walk(parseBlocks(bodies.home!).blocks, (block) => {
      if (block.kind === 'component') {
        used.add(block.name)
      }
    })

    expect([...used].sort()).toEqual(
      [
        'block-accordion',
        'block-accordion-item',
        'block-button',
        'block-column',
        'block-columns',
        'block-counter',
        'block-divider',
        'block-gallery',
        'block-heading',
        'block-icon',
        'block-icon-box',
        'block-icon-list',
        'block-icon-list-item',
        'block-image',
        'block-image-box',
        'block-section',
        'block-social-icons',
        'block-social-link',
        'block-spacer',
        'block-testimonial',
        'block-text',
        'block-video',
      ].sort()
    )
  })
})
