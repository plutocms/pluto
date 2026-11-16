import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resolveBlockDefinition } from '../../../core/shared/utils/blocks/registry'
import { BLOCKS_WIDGETS } from '../app/utils/blocks-names'
import { contentDir, readBlocks } from './helpers'

const NAMES = [
  'block-section',
  'block-columns',
  'block-column',
  'block-heading',
  'block-text',
  'block-image',
  'block-button',
  'block-icon',
  'block-divider',
  'block-spacer',
  'block-video',
  'block-icon-list',
  'block-icon-list-item',
  'block-icon-box',
  'block-image-box',
  'block-accordion',
  'block-accordion-item',
  'block-testimonial',
  'block-counter',
  'block-social-icons',
  'block-social-link',
  'block-gallery',
]

const PROP_TYPES = [
  'string',
  'text',
  'boolean',
  'number',
  'select',
  'icon',
  'color',
  'link',
  'media',
]

const warnings: string[] = []
const components = readBlocks((message) => warnings.push(message))

const sources = { components }

describe('the block definitions, read by the parser of core', () => {
  it('finds one block for each component file, with no warning', () => {
    const files = readdirSync(contentDir).filter((file) =>
      file.endsWith('.vue')
    ).length

    expect(warnings).toEqual([])
    expect(Object.keys(components).sort()).toEqual([...NAMES].sort())
    expect(files).toBe(NAMES.length)
  }, 120_000)

  it.each(NAMES)('%s is a valid definition', (name) => {
    const definition = resolveBlockDefinition(name, { sources })

    expect(definition.name).toBe(name)
    expect(definition.label, 'label').not.toBe('')
    expect(definition.label).not.toBe(name)
    expect(definition.description, 'description').toBeTruthy()
    expect(definition.icon).toMatch(/^i-lucide-[a-z0-9-]+$/)
    expect(['layout', 'text', 'media', 'landing']).toContain(definition.group)

    for (const [prop, value] of Object.entries(definition.props ?? {})) {
      expect(PROP_TYPES, `${name}.${prop}`).toContain(value.type)
      if (value.type === 'select') {
        expect(
          value.options?.length,
          `${name}.${prop} options`
        ).toBeGreaterThan(0)
      }
    }

    for (const [slot, value] of Object.entries(definition.slots ?? {})) {
      expect(['rich', 'inline', 'blocks'], `${name} slot ${slot}`).toContain(
        value.content
      )
      for (const accepted of value.accepts ?? []) {
        expect(NAMES, `${name} accepts ${accepted}`).toContain(accepted)
      }
    }
  })

  it('gives every block with a default slot a content kind', () => {
    for (const name of NAMES) {
      const slot = resolveBlockDefinition(name, { sources }).slots?.default
      if (slot) {
        expect(slot.content, name).toBeDefined()
      }
    }
  })

  it('lets a section hold columns and the widgets', () => {
    const accepts = resolveBlockDefinition('block-section', { sources }).slots!
      .default!.accepts!

    expect(accepts).toContain('block-columns')
    for (const widget of BLOCKS_WIDGETS) {
      expect(accepts).toContain(widget)
    }
    expect(accepts).not.toContain('block-column')
    expect(accepts).not.toContain('block-section')
  })

  it('lets columns hold columns, and a column hold widgets and columns', () => {
    const columns = resolveBlockDefinition('block-columns', { sources }).slots!
    const column = resolveBlockDefinition('block-column', { sources }).slots!

    expect(columns.default!.accepts).toEqual(['block-column'])
    expect(column.default!.accepts).toContain('block-columns')
    expect(column.default!.accepts).toContain('block-button')
  })

  it('makes the text of a heading an inline slot, and a text block a rich slot', () => {
    expect(
      resolveBlockDefinition('block-heading', { sources }).slots!.default!
        .content
    ).toBe('inline')
    expect(
      resolveBlockDefinition('block-text', { sources }).slots!.default!.content
    ).toBe('rich')
  })

  it('has the options of the heading level, the button variant and the stack', () => {
    const values = (name: string, prop: string) =>
      (
        resolveBlockDefinition(name, { sources }).props![prop]!.options ?? []
      ).map((option) => (typeof option === 'string' ? option : option.value))

    expect(values('block-heading', 'level')).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
    ])
    expect(values('block-button', 'variant')).toEqual([
      'solid',
      'outline',
      'link',
    ])
    expect(values('block-columns', 'stack')).toEqual(['md', 'sm', 'never'])
    expect(values('block-section', 'padding')).toEqual([
      'none',
      'xs',
      'sm',
      'md',
      'lg',
      'xl',
      '2xl',
    ])
  })

  it('has defaults for the props that have a usual value', () => {
    const props = (name: string) =>
      resolveBlockDefinition(name, { sources }).props!

    expect(props('block-section').padding!.default).toBe('lg')
    expect(props('block-section').width!.default).toBe('contained')
    expect(props('block-columns').gap!.default).toBe('md')
    expect(props('block-columns').stack!.default).toBe('md')
    expect(props('block-button').variant!.default).toBe('solid')
    expect(props('block-heading').level!.default).toBe(2)
  })

  it('types the media, the links and the icons', () => {
    const props = (name: string) =>
      resolveBlockDefinition(name, { sources }).props!

    expect(props('block-image').src!.type).toBe('media')
    expect(props('block-section').image!.type).toBe('media')
    expect(props('block-button').link!.type).toBe('link')
    expect(props('block-icon').icon!.type).toBe('icon')
    expect(props('block-icon-box').icon!.type).toBe('icon')
  })
})
