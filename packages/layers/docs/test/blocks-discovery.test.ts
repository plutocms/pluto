import type {
  BlockLog,
  MetaReader,
  ParsedComponent,
} from '../modules/pluto-docs/blocks'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BlockCatalog,
  blocksModuleSource,
  findContentComponents,
  hasBlockMacro,
  readBlockEntry,
} from '../modules/pluto-docs/blocks'

const fixture = join(__dirname, 'fixtures', 'discovery')
const appDir = join(fixture, 'app', 'components', 'content')
const layerDir = join(fixture, 'layer', 'components', 'content')

function logger(): BlockLog & { warnings: string[]; debugs: string[] } {
  const warnings: string[] = []
  const debugs: string[] = []
  return {
    warnings,
    debugs,
    warn: (message) => warnings.push(message),
    debug: (message) => debugs.push(message),
  }
}

describe('hasBlockMacro', () => {
  it('finds the call, with and without a generic', () => {
    expect(hasBlockMacro('definePlutoBlock({})')).toBe(true)
    expect(hasBlockMacro('definePlutoBlock <Props>({ label: "A" })')).toBe(true)
    expect(hasBlockMacro('definePlutoBlock<Props>({})')).toBe(true)
  })

  it('ignores a file without the call', () => {
    expect(hasBlockMacro('defineProps<{ a: string }>()')).toBe(false)
    expect(hasBlockMacro('const definePlutoBlockX = 1')).toBe(false)
  })
})

describe('findContentComponents', () => {
  it('reads the app and the layer folders, and the first folder wins', () => {
    const found = findContentComponents([appDir, layerDir])
    const names = found.map((item) => item.name)
    expect(names).toEqual(['Callout', 'LocalVar', 'Plain', 'LayerCard', 'Deep'])
    expect(found.find((item) => item.name === 'Callout')?.file).toBe(
      join(appDir, 'Callout.vue')
    )
  })

  it('skips Prose overrides', () => {
    expect(
      findContentComponents([appDir]).some((item) => item.name === 'ProseNote')
    ).toBe(false)
  })

  it('skips a folder that does not exist', () => {
    expect(findContentComponents([join(fixture, 'missing')])).toEqual([])
  })
})

describe('readBlockEntry', () => {
  const file = { name: 'ThingCard', file: '/site/ThingCard.vue' }

  it('does not run the parser for a file without the macro', () => {
    const read = vi.fn()
    const entry = readBlockEntry(file, '<template><div /></template>', read)
    expect(read).not.toHaveBeenCalled()
    expect(entry.block).toBeUndefined()
    expect(entry.warnings).toEqual([])
  })

  it('makes a block from the meta and the macro', () => {
    const read: MetaReader = () =>
      ({
        props: [{ name: 'dense', type: 'boolean | undefined' }],
        slots: [],
        pluto: { label: 'Thing', icon: 'i-lucide-box' },
      }) as ParsedComponent
    const entry = readBlockEntry(file, 'definePlutoBlock({})', read)
    expect(entry.warnings).toEqual([])
    expect(entry.block?.name).toBe('thing-card')
    expect(entry.block?.definition.label).toBe('Thing')
    expect(entry.block?.definition.props?.dense).toMatchObject({
      type: 'boolean',
    })
  })

  it('warns and skips when the parser throws', () => {
    const read: MetaReader = () => {
      throw new Error('bad syntax')
    }
    const entry = readBlockEntry(file, 'definePlutoBlock({})', read)
    expect(entry.block).toBeUndefined()
    expect(entry.warnings).toHaveLength(1)
    expect(entry.warnings[0]).toContain('/site/ThingCard.vue')
    expect(entry.warnings[0]).toContain('bad syntax')
  })

  it('warns and skips when the parser cannot read the macro', () => {
    const read: MetaReader = () => ({ props: [], slots: [] })
    const entry = readBlockEntry(file, 'definePlutoBlock({ label })', read)
    expect(entry.block).toBeUndefined()
    expect(entry.warnings[0]).toContain('/site/ThingCard.vue')
    expect(entry.warnings[0]).toContain('local variable')
  })

  it('reports the time of the parse', () => {
    let tick = 0
    const entry = readBlockEntry(
      file,
      'definePlutoBlock({})',
      () => ({ pluto: {} }) as ParsedComponent,
      () => (tick += 7)
    )
    expect(entry.ms).toBe(7)
  })
})

describe('blockCatalog', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  function temp(files: Record<string, string>) {
    const root = mkdtempSync(join(tmpdir(), 'pluto-blocks-'))
    dirs.push(root)
    mkdirSync(root, { recursive: true })
    for (const [name, text] of Object.entries(files)) {
      writeFileSync(join(root, name), text)
    }
    return root
  }

  const read: MetaReader = vi.fn(
    () => ({ props: [], slots: [], pluto: { label: 'A' } }) as ParsedComponent
  )

  it('parses a file once and again only when its text changes', () => {
    vi.mocked(read).mockClear()
    const root = temp({
      'One.vue': 'definePlutoBlock({ label: "A" })',
      'Two.vue': 'definePlutoBlock({ label: "A" })',
      'Three.vue': '<template />',
    })
    const log = logger()
    const catalog = new BlockCatalog(() => [root], read, log)
    expect(Object.keys(catalog.collect()).sort()).toEqual(['one', 'two'])
    expect(read).toHaveBeenCalledTimes(2)
    catalog.collect()
    expect(read).toHaveBeenCalledTimes(2)
    writeFileSync(join(root, 'Two.vue'), 'definePlutoBlock({ label: "B" })')
    catalog.collect()
    expect(read).toHaveBeenCalledTimes(3)
    expect(log.debugs.some((line) => line.startsWith('Read 2'))).toBe(true)
  })

  it('drops a deleted file and warns once for a bad file', () => {
    const root = temp({
      'Bad.vue': 'definePlutoBlock({ label })',
      'Good.vue': 'definePlutoBlock({})',
    })
    const log = logger()
    const catalog = new BlockCatalog(
      () => [root],
      (path) =>
        path.endsWith('Bad.vue')
          ? ({ props: [] } as ParsedComponent)
          : ({ pluto: {} } as ParsedComponent),
      log
    )
    expect(Object.keys(catalog.collect())).toEqual(['good'])
    catalog.collect()
    expect(log.warnings).toHaveLength(1)
    rmSync(join(root, 'Good.vue'))
    expect(catalog.collect()).toEqual({})
  })
})

describe('blocksModuleSource', () => {
  it('makes a default export', () => {
    expect(blocksModuleSource({ a: { label: 'A' } })).toBe(
      'export default {"a":{"label":"A"}}\n'
    )
    expect(blocksModuleSource({})).toBe('export default {}\n')
  })
})
