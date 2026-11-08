import { describe, expect, it } from 'vitest'
import { setProps } from '../shared/utils/blocks/operations'
import { parseBlocks } from '../shared/utils/blocks/parse'
import { resolveBlockDefinition } from '../shared/utils/blocks/registry'
import { serializeBlocks } from '../shared/utils/blocks/serialize'

// The Image block (`pluto-figure`): a `media` prop that a choice from the media library fills
// with the URL, the size and the alt text, in one edit.

describe('the Image block', () => {
  it('has a media prop that fills the size and the alt text', () => {
    const definition = resolveBlockDefinition('pluto-figure')

    expect(definition).toMatchObject({
      group: 'media',
      icon: 'i-lucide-image',
      insert: '::pluto-figure\n::',
    })
    expect(definition.props?.src).toMatchObject({
      type: 'media',
      fills: { width: 'width', height: 'height', alt: 'alt' },
    })
    expect(definition.props?.dark?.type).toBe('media')
    expect(definition.props?.width).toMatchObject({
      type: 'number',
      advanced: true,
    })
  })
})

describe('setProps', () => {
  it('sets some props in one edit and writes them back', () => {
    const doc = parseBlocks('Intro.\n\n::pluto-figure\n::\n\nMore.\n')
    const id = doc.blocks[1]!.id

    const next = setProps(doc, id, {
      src: '/media/2026/11/admin-home-k3j9a.png',
      width: 1440,
      height: 900,
      alt: 'The admin dashboard',
    })

    expect(serializeBlocks(next)).toBe(
      `Intro.\n\n::pluto-figure{src="/media/2026/11/admin-home-k3j9a.png" :width='1440' :height='900' alt="The admin dashboard"}\n::\n\nMore.\n`
    )
  })

  it('removes a prop set to undefined, and returns the same doc for no change', () => {
    const doc = parseBlocks('::pluto-figure{src="/a.png" alt="A"}\n::\n')
    const id = doc.blocks[0]!.id

    expect(serializeBlocks(setProps(doc, id, { src: undefined }))).toBe(
      '::pluto-figure{alt="A"}\n::\n'
    )
    expect(setProps(doc, id, { src: '/a.png' })).toBe(doc)
  })
})
