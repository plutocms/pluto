import type {
  PlutoComponentMeta,
  PlutoMetaProp,
} from '../shared/utils/blocks/component-meta'
import type { PlutoComponentBlock } from '../shared/utils/blocks/types'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  blockFromComponentMeta,
  componentBlockName,
  parseDefault,
} from '../shared/utils/blocks/component-meta'
import { parseBlocks } from '../shared/utils/blocks/parse'
import { resolveBlockDefinition } from '../shared/utils/blocks/registry'

// The fixtures are the output of `getComponentMeta` (nuxt-component-meta 0.18.0) for three
// components of the docs site, with the `global` and `tags` keys and the extras taken out.

function fixture(name: string): PlutoComponentMeta {
  return JSON.parse(
    readFileSync(
      join(__dirname, 'fixtures', 'component-meta', `${name}.json`),
      'utf8'
    )
  )
}

function propOf(
  name: string,
  type: string,
  extra: Partial<PlutoMetaProp> = {}
): PlutoComponentMeta {
  return { props: [{ name, type, schema: type, ...extra }] }
}

/** The definition that one prop of the given type gets. */
function widget(name: string, type: string) {
  return blockFromComponentMeta('Thing', propOf(name, type)).definition.props?.[
    name
  ]
}

describe('componentBlockName', () => {
  it('turns a Pascal name into the kebab key', () => {
    expect(componentBlockName('PlutoHero')).toBe('pluto-hero')
    expect(componentBlockName('UPageCTA')).toBe('u-page-c-t-a')
    expect(componentBlockName('Hero')).toBe('hero')
  })
})

describe('prop type to widget', () => {
  it('maps string, number and boolean', () => {
    expect(widget('title', 'string | undefined')).toMatchObject({
      type: 'string',
    })
    expect(widget('count', 'number | undefined')).toMatchObject({
      type: 'number',
    })
    expect(widget('flag', 'boolean | undefined')).toMatchObject({
      type: 'boolean',
    })
    expect(widget('flag', 'boolean')).toMatchObject({ type: 'boolean' })
    expect(widget('size', 'string | number')).toMatchObject({ type: 'string' })
  })

  it('maps an icon and a link by name', () => {
    expect(widget('icon', 'string')).toMatchObject({
      type: 'icon',
      label: 'docs.blocks.props.icon',
    })
    expect(widget('trailingIcon', 'string | undefined')).toMatchObject({
      type: 'icon',
    })
    expect(widget('to', 'string')).toMatchObject({ type: 'link' })
    expect(widget('href', 'string | undefined')).toMatchObject({ type: 'link' })
    expect(widget('to', 'RouteLocationRaw')).toMatchObject({ type: 'link' })
    expect(widget('to', 'string | RouteLocationAsPathGeneric')).toMatchObject({
      type: 'link',
    })
    expect(widget('target', 'string')).toMatchObject({ type: 'string' })
  })

  it('maps a union of string literals to a select, in source order', () => {
    expect(widget('speed', '"slow" | "normal" | "fast" | undefined')).toEqual({
      type: 'select',
      options: [{ value: 'slow' }, { value: 'normal' }, { value: 'fast' }],
    })
  })

  it('maps a union of theme colors to a color', () => {
    expect(widget('shade', '"primary" | "error" | undefined')).toMatchObject({
      type: 'color',
      options: [{ value: 'primary' }, { value: 'error' }],
    })
  })

  it('reads an enum schema', () => {
    const meta: PlutoComponentMeta = {
      props: [
        {
          name: 'speed',
          type: '"a" | "b" | undefined',
          schema: {
            kind: 'enum',
            type: '"a" | "b" | undefined',
            schema: { 0: 'undefined', 1: '"a"', 2: '"b"' },
          },
        },
      ],
    }
    expect(blockFromComponentMeta('X', meta).definition.props!.speed).toEqual({
      type: 'select',
      options: [{ value: 'a' }, { value: 'b' }],
    })
  })

  it('leaves out a prop that no widget fits', () => {
    for (const type of [
      '{ min: number; max: number; }',
      'string[]',
      '() => void',
      '1 | 2 | 3',
      'string[] | number[]',
      'Record<string, string>',
      'undefined',
    ]) {
      expect(widget('value', type), type).toBeUndefined()
    }
    expect(
      blockFromComponentMeta('X', propOf('value', 'string[]')).definition
    ).toEqual({})
  })

  it('does not split a union inside quotes or brackets', () => {
    expect(widget('mode', '"a | b" | "c"')).toMatchObject({
      type: 'select',
      options: [{ value: 'a | b' }, { value: 'c' }],
    })
  })
})

describe('defaults, descriptions and labels', () => {
  it('reads a simple default from source text', () => {
    expect(parseDefault('300')).toBe(300)
    expect(parseDefault('-1.5')).toBe(-1.5)
    expect(parseDefault('false')).toBe(false)
    expect(parseDefault('"normal"')).toBe('normal')
    expect(parseDefault("'x'")).toBe('x')
    expect(parseDefault('undefined')).toBeUndefined()
    expect(parseDefault('{\n  min: 1\n}')).toBeUndefined()
    expect(parseDefault('() => 3')).toBeUndefined()
    expect(parseDefault(undefined)).toBeUndefined()
  })

  it('takes the description from the JSDoc text', () => {
    const meta = propOf('title', 'string', { description: ' The title.\n' })
    expect(blockFromComponentMeta('X', meta).definition.props!.title).toEqual({
      type: 'string',
      label: 'docs.blocks.props.title',
      description: 'The title.',
    })
  })

  it('has no label for a prop that the presets do not know', () => {
    expect(widget('starCount', 'number')).not.toHaveProperty('label')
  })
})

describe('real meta fixtures', () => {
  it('starsBg: three props, no slot, and the object prop is left out', () => {
    const { name, definition } = blockFromComponentMeta(
      'StarsBg',
      fixture('StarsBg')
    )
    expect(name).toBe('stars-bg')
    expect(definition).toEqual({
      props: {
        starCount: { type: 'number', default: 300 },
        color: {
          type: 'string',
          label: 'docs.blocks.props.color',
          default: 'var(--ui-primary)',
        },
        speed: {
          type: 'select',
          options: [{ value: 'normal' }, { value: 'slow' }, { value: 'fast' }],
          default: 'normal',
        },
      },
    })
  })

  it('plutoChip: an icon, a switch and an inline default slot', () => {
    const { name, definition } = blockFromComponentMeta(
      'PlutoChip',
      fixture('PlutoChip')
    )
    expect(name).toBe('pluto-chip')
    expect(definition.props).toEqual({
      icon: { type: 'icon', label: 'docs.blocks.props.icon' },
      center: { type: 'boolean', default: false },
    })
    expect(definition.slots).toEqual({
      default: { label: 'docs.blocks.slots.default', content: 'inline' },
    })
  })

  it('plutoHero: no props, and only the unwrap slots are inline', () => {
    const { definition } = blockFromComponentMeta(
      'PlutoHero',
      fixture('PlutoHero')
    )
    expect(definition.props).toBeUndefined()
    expect(Object.keys(definition.slots!)).toEqual([
      'headline',
      'title',
      'description',
      'links',
      'default',
      'notice',
    ])
    expect(definition.slots!.title).toMatchObject({ content: 'inline' })
    expect(definition.slots!.links).not.toHaveProperty('content')
    expect(definition.slots!.default).not.toHaveProperty('content')
    expect(definition.slots!.notice).toMatchObject({ content: 'inline' })
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
})

describe('the macro', () => {
  it('wins over the meta key by key', () => {
    const { definition } = blockFromComponentMeta(
      'PlutoChip',
      fixture('PlutoChip'),
      {
        label: 'Chip',
        icon: 'i-lucide-tag',
        group: 'landing',
        props: { icon: { label: 'Symbol' }, center: { advanced: true } },
        slots: { default: { label: 'Text' } },
      }
    )
    expect(definition).toMatchObject({
      label: 'Chip',
      icon: 'i-lucide-tag',
      group: 'landing',
    })
    expect(definition.props).toEqual({
      icon: { type: 'icon', label: 'Symbol' },
      center: { type: 'boolean', default: false, advanced: true },
    })
    expect(definition.slots).toEqual({
      default: { label: 'Text', content: 'inline' },
    })
  })

  it('can give a widget to a prop the meta left out', () => {
    const { definition } = blockFromComponentMeta(
      'StarsBg',
      fixture('StarsBg'),
      { props: { size: { type: 'text' } } }
    )
    expect(definition.props!.size).toEqual({ type: 'text' })
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

  it('works with no meta and with a macro of {}', () => {
    expect(blockFromComponentMeta('Empty', {}, {}).definition).toEqual({})
    expect(blockFromComponentMeta('Empty', {}, { label: 'E' })).toEqual({
      name: 'empty',
      definition: { label: 'E' },
    })
  })
})
