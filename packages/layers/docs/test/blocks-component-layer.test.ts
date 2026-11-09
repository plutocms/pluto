import type { PlutoComponentMeta } from '#layers/pluto/shared/utils/blocks/component-meta'
import type { PlutoComponentBlock } from '../shared/utils/blocks/types'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { blockFromComponentMeta } from '#layers/pluto/shared/utils/blocks/component-meta'
import { parseBlocks } from '../shared/utils/blocks/parse'
import { resolveBlockDefinition } from '../shared/utils/blocks/registry'

// The component layer of core (made from the component meta) in the block editor of the docs
// layer: the shared labels of the presets, the kebab props of a page, and `false` slots. The
// fixtures are the ones of the core tests.

function fixture(name: string): PlutoComponentMeta {
  return JSON.parse(
    readFileSync(
      join(__dirname, '../../../core/test/fixtures/component-meta', `${name}.json`),
      'utf8'
    )
  )
}

describe('the component layer in the block editor', () => {
  it('gives the shared label of a preset prop or slot with the same name', () => {
    const { name, definition } = blockFromComponentMeta(
      'PlutoChip',
      fixture('PlutoChip')
    )
    const resolved = resolveBlockDefinition(name, {
      sources: { components: { [name]: definition } },
    })
    expect(resolved.props!.icon).toMatchObject({
      type: 'icon',
      label: 'docs.blocks.props.icon',
    })
    expect(resolved.props!.center).not.toHaveProperty('label')
    expect(resolved.slots!.default).toMatchObject({
      label: 'docs.blocks.slots.default',
      content: 'inline',
    })
  })

  it('keeps the label of the macro', () => {
    const { name, definition } = blockFromComponentMeta(
      'PlutoChip',
      fixture('PlutoChip'),
      { props: { icon: { label: 'Symbol' } } }
    )
    const resolved = resolveBlockDefinition(name, {
      sources: { components: { [name]: definition } },
    })
    expect(resolved.props!.icon!.label).toBe('Symbol')
  })

  it('makes a definition that resolves, and keeps the kebab prop of a page', () => {
    const { name, definition } = blockFromComponentMeta(
      'StarsBg',
      fixture('StarsBg')
    )
    const doc = parseBlocks('::stars-bg{star-count="160"}\n::\n')
    const resolved = resolveBlockDefinition(name, {
      sources: { components: { [name]: definition } },
      block: doc.blocks[0] as PlutoComponentBlock,
    })
    expect(Object.keys(resolved.props!)).toContain('star-count')
    expect(Object.keys(resolved.props!)).not.toContain('starCount')
  })

  it('removes a slot with false, and keeps the false for the layers above', () => {
    const { definition } = blockFromComponentMeta(
      'PlutoHero',
      fixture('PlutoHero'),
      { slots: { notice: false } }
    )
    expect(definition.slots!.notice).toBe(false)
    const resolved = resolveBlockDefinition('pluto-hero', {
      sources: { components: { 'pluto-hero': definition } },
    })
    expect(resolved.slots).not.toHaveProperty('notice')
  })
})
