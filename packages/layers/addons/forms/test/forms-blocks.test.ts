import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resolveBlockDefinition } from '../../../../core/shared/utils/blocks/registry'
import { PLUTO_FORM_BLOCKS } from '../shared/utils/forms-fields'
import { contentDir, readBlocks } from './helpers'

const FIELD_BLOCKS = [...PLUTO_FORM_BLOCKS]

const warnings: string[] = []
const components = readBlocks((message) => warnings.push(message))
const sources = { components }

describe('the form blocks, read by the parser of core', () => {
  it('finds one block for each component file, with no warning', () => {
    const files = readdirSync(contentDir).filter((file) => file.endsWith('.vue'))

    expect(warnings).toEqual([])
    expect(Object.keys(components).sort()).toEqual(
      [...FIELD_BLOCKS, 'pluto-form'].sort()
    )
    expect(files).toHaveLength(FIELD_BLOCKS.length + 1)
  }, 120_000)

  it.each(FIELD_BLOCKS)('%s is hidden from the palette of the pages', (name) => {
    const definition = resolveBlockDefinition(name, { sources })

    expect(definition.hidden).toBe(true)
    expect(definition.group).toBe('form')
    expect(definition.label).not.toBe(name)
    expect(definition.description).toBeTruthy()
    expect(definition.insert).toMatch(new RegExp(`^::${name}\{?`))
  })

  it('shows the form block in the palette, with the handle as a prop', () => {
    const definition = resolveBlockDefinition('pluto-form', { sources })

    expect(definition.hidden).toBeFalsy()
    expect(definition.props?.form).toBeDefined()
  })

  it('gives the select and the radio an options prop, and the input a type', () => {
    for (const name of ['form-select', 'form-radio']) {
      expect(resolveBlockDefinition(name, { sources }).props?.options?.type).toBe('text')
    }
    expect(resolveBlockDefinition('form-input', { sources }).props?.type?.options).toContain('email')
  })
})
