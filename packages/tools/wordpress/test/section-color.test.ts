import { describe, expect, it } from 'vitest'
import { convertElements } from '../src/convert'
import { luminanceOf } from '../src/section-color'
import { container, context, widget } from './fixtures'

const white = { title_color: '#FFFFFF' }

function section(
  settings: Record<string, unknown>,
  widgets = [
    widget('heading', { title: 'A', ...white }),
    widget('text-editor', { editor: '<p>B</p>', text_color: '#FFFFFF' }),
    widget('shortcode', { shortcode: '[x]' }),
  ]
) {
  return convertElements(context(), [container(settings, widgets)])[0]!
}

const IMAGE = {
  background_background: 'classic',
  background_image: { url: 'https://a.test/h.jpg' },
}

describe('luminanceOf', () => {
  it('reads hex and rgb colors', () => {
    expect(luminanceOf('#000000')).toBe(0)
    expect(luminanceOf('#ffffff')).toBeCloseTo(1)
    expect(luminanceOf('#fff')).toBeCloseTo(1)
    expect(luminanceOf('rgb(0, 0, 0)')).toBe(0)
    expect(luminanceOf('primary')).toBeUndefined()
  })
})

describe('the text color of a section', () => {
  it('moves a shared color to a section with a dark overlay on an image', () => {
    const node = section({
      ...IMAGE,
      background_overlay_background: 'classic',
      background_overlay_color: '#000000',
    })

    expect(node.props.color).toBe('#FFFFFF')
    expect(node.children!.map((child) => child.props.color)).toEqual([
      undefined,
      undefined,
      undefined,
    ])
  })

  it('moves it to a section with a dark background', () => {
    const node = section({
      background_background: 'classic',
      background_color: '#111111',
    })

    expect(node.props.color).toBe('#FFFFFF')
  })

  it('moves it to a section with an image and no overlay', () => {
    expect(section(IMAGE).props.color).toBe('#FFFFFF')
  })

  it('does nothing when the overlay is light', () => {
    const node = section({
      ...IMAGE,
      background_overlay_background: 'classic',
      background_overlay_color: '#FFFFFF',
    })

    expect(node.props.color).toBeUndefined()
    expect(node.children![0]!.props.color).toBe('#FFFFFF')
  })

  it('does nothing when the background is light or has no color', () => {
    expect(
      section({ background_background: 'classic', background_color: '#F5F6F6' })
        .props.color
    ).toBeUndefined()
    expect(section({}).props.color).toBeUndefined()
  })

  it('does nothing when the colors differ', () => {
    const node = section(
      { background_background: 'classic', background_color: '#111111' },
      [
        widget('heading', { title: 'A', ...white }),
        widget('text-editor', { editor: '<p>B</p>', text_color: '#CCCCCC' }),
      ]
    )

    expect(node.props.color).toBeUndefined()
    expect(node.children![0]!.props.color).toBe('#FFFFFF')
  })

  it('looks inside columns', () => {
    const node = convertElements(context(), [
      container(
        { background_background: 'classic', background_color: '#000000' },
        [
          container({ flex_direction: 'row' }, [
            container({}, [widget('heading', { title: 'A', ...white })], true),
            container(
              {},
              [
                widget('counter', {
                  ending_number: '5',
                  number_color: '#FFFFFF',
                }),
              ],
              true
            ),
          ]),
        ]
      ),
    ])[0]!

    expect(node.props.color).toBe('#FFFFFF')
  })
})
