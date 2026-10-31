import { join } from 'node:path'
import { getComponentMeta } from 'nuxt-component-meta/parser'
import { describe, expect, it } from 'vitest'
import {
  BLOCK_MACRO,
  BlockCatalog,
  MACRO_KEY,
} from '../modules/pluto-docs/blocks'

// The real parser (nuxt-component-meta, with the TypeScript checker). It takes about a second for
// each component, so this file is the one slow test.

const fixture = join(__dirname, 'fixtures', 'discovery')

const read = (file: string) =>
  getComponentMeta(file, {
    rootDir: fixture,
    extendMetaFunctions: [
      { name: BLOCK_MACRO, transform: (arg) => ({ [MACRO_KEY]: arg }) },
    ],
  }) as never

describe('discovery with the real parser', () => {
  it('finds the macro components of the app and the layer folders', () => {
    const warnings: string[] = []
    const catalog = new BlockCatalog(
      () => [
        join(fixture, 'app', 'components', 'content'),
        join(fixture, 'layer', 'components', 'content'),
      ],
      read,
      { warn: (message) => warnings.push(message), debug: () => {} }
    )
    const blocks = catalog.collect() as Record<string, any>

    // Opt-in: `Plain` has no macro. A `Prose*` file is never read.
    expect(Object.keys(blocks).sort()).toEqual([
      'callout',
      'deep',
      'layer-card',
    ])

    // The app copy of `Callout` wins over the layer copy. The macro uses an imported constant.
    const callout = blocks.callout
    expect(callout.label).toBe('Callout')
    expect(callout.icon).toBe('i-lucide-info')
    expect(callout.props.tone.type).toBe('select')
    expect(callout.props.tone.options).toEqual([
      { value: 'compact' },
      { value: 'wide' },
    ])
    expect(callout.props.tone.description).toBe('The look of the callout.')
    expect(callout.props.dense.type).toBe('boolean')
    expect(callout.slots.default.content).toBe('inline')

    // `definePlutoBlock({})` in a layer folder: the props come from the types.
    const card = blocks['layer-card']
    expect(card.props.title.type).toBe('string')
    expect(card.props.count.type).toBe('number')

    // A local variable gives a warning that names the file. No block is made.
    expect(warnings.some((line) => line.includes('LocalVar.vue'))).toBe(true)
    expect(blocks['local-var']).toBeUndefined()
    expect(warnings.some((line) => line.includes('Plain.vue'))).toBe(false)
  }, 60_000)
})
