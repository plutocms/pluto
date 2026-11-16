import { describe, expect, it } from 'vitest'
import { convertElements } from '../src/convert'
import { widgetNodes } from '../src/widgets'
import { container, context, widget } from './fixtures'

function convert(elements: Parameters<typeof convertElements>[1]) {
  return convertElements(context(), elements)
}

describe('the page background', () => {
  it('gives a section with no bg and no image the background token', () => {
    const nodes = convert([
      container({}, [widget('spacer')]),
      container(
        { background_background: 'classic', background_color: '#111111' },
        [widget('spacer')]
      ),
      container(
        {
          background_background: 'classic',
          background_image: { url: 'https://a.test/b.jpg' },
        },
        [widget('spacer')]
      ),
      widget('spacer'),
    ])

    expect(nodes.map((node) => node.props.bg)).toEqual([
      'background',
      '#111111',
      undefined,
      'background',
    ])
  })
})

describe('the image size', () => {
  const image = { url: 'https://a.test/x.png', alt: 'x' }
  const width = (settings: Record<string, unknown>) =>
    widgetNodes(context(), widget('image', { image, ...settings }))[0]!.props
      .width

  it('sets the width from the WordPress image size, and not for full', () => {
    expect(width({ image_size: 'thumbnail' })).toBe('150px')
    expect(width({ image_size: 'medium' })).toBe('300px')
    expect(width({ image_size: 'medium_large' })).toBe('768px')
    expect(width({ image_size: 'large' })).toBe('1024px')
    expect(width({ image_size: 'full' })).toBeUndefined()
    expect(
      width({ image_size: 'custom', image_custom_dimension: { width: '120' } })
    ).toBe('120px')
  })

  it('prefers an explicit width over the image size', () => {
    expect(
      width({ image_size: 'thumbnail', width: { unit: '%', size: 50 } })
    ).toBe('50%')
  })
})
