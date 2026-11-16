import { describe, expect, it } from 'vitest'
import { convertElements } from '../src/convert'
import { serializeBlocks } from '../src/mdc'
import { emptyKit } from '../src/theme'
import { container, context, HOME_ELEMENTS, widget } from './fixtures'

function convert(
  elements: Parameters<typeof convertElements>[1],
  overrides: Parameters<typeof context>[0] = {}
) {
  const ctx = context(overrides)

  return { ctx, nodes: convertElements(ctx, elements) }
}

describe('a top-level container', () => {
  const { ctx, nodes } = convert([HOME_ELEMENTS[0]!])
  const [section] = nodes

  it('becomes a block-section with its background, overlay, padding and height', () => {
    expect(section!.name).toBe('block-section')
    expect(section!.props).toMatchObject({
      anchor: 'top',
      image: 'https://old.example.test/wp-content/uploads/2024/01/hero-bg.jpg',
      overlay: '#000000',
      overlayOpacity: 36,
      padding: 'xl',
      minHeight: '60vh',
      maxWidth: '1000px',
      align: 'center',
    })
    expect(section!.props.bg).toBeUndefined()
  })

  it('puts the widgets directly in the section', () => {
    expect(section!.children!.map((child) => child.name)).toEqual([
      'block-heading',
      'block-text',
      'block-button',
      'block-text',
      '#html',
      'block-text',
      'block-text',
    ])
  })

  it('skips an element that is hidden on desktop', () => {
    expect(JSON.stringify(nodes)).not.toContain('Hidden')
    expect(ctx.report.ignoredStyles['hidden on desktop (skipped)']).toBe(1)
  })

  it('counts the responsive values it drops, but not the direction of a row', () => {
    expect(ctx.report.droppedResponsive).toBe(2)
  })

  it('reports the add-on prefix of a widget', () => {
    expect(ctx.report.addonPrefixes).toEqual(['eael_'])
  })

  it('reports each placeholder', () => {
    expect(ctx.report.placeholders).toEqual([
      'shortcode [contact-form-7 id="12"]',
      'widget eael-fancy-box',
      'widget nav-menu',
    ])
    expect(ctx.report.unknownWidgets).toEqual({
      'eael-fancy-box': 1,
      'nav-menu': 1,
    })
  })

  it('has padding none when the container has none', () => {
    const { nodes: plain } = convert([container({}, [widget('spacer')])])

    expect(plain[0]!.props.padding).toBe('none')
    expect(plain[0]!.props.width).toBeUndefined()
  })

  it('uses a full width for a full container', () => {
    const { nodes: full } = convert([
      container({ content_width: 'full' }, [widget('spacer')]),
    ])

    expect(full[0]!.props.width).toBe('full')
  })

  it('skips an empty container, unless it has a height or a background', () => {
    expect(convert([container({}, [])]).nodes).toEqual([])
    expect(
      convert([container({ min_height: { unit: 'px', size: 200 } }, [])]).nodes
    ).toHaveLength(1)
  })

  it('wraps a widget at the top level in a section', () => {
    const { nodes: wrapped } = convert([widget('spacer')])

    expect(wrapped[0]).toMatchObject({
      name: 'block-section',
      children: [{ name: 'block-spacer' }],
    })
  })
})

describe('a row of containers', () => {
  const { ctx, nodes } = convert([HOME_ELEMENTS[1]!], {
    kit: { ...emptyKit(), globalColors: { ab12cd3: '#F5F6F6' } },
  })
  const columns = nodes[0]!.children![0]!

  it('becomes block-columns with a block-column for each container', () => {
    expect(columns.name).toBe('block-columns')
    expect(columns.props).toMatchObject({ gap: 'sm', valign: 'center' })
    expect(columns.children!.map((column) => column.name)).toEqual([
      'block-column',
      'block-column',
    ])
    expect(columns.props.stack).toBeUndefined()
  })

  it('takes the width, the background, the radius and the shadow of a column', () => {
    const [first, second] = columns.children!

    expect(first!.props.width).toBe('40')
    expect(second!.props).toMatchObject({
      width: '60',
      bg: '#FFFFFF',
      padding: 'md',
      radius: 'md',
      shadow: 'md',
      valign: 'center',
    })
  })

  it('takes the section background from a custom global color', () => {
    expect(nodes[0]!.props.bg).toBe('#F5F6F6')
  })

  it('puts the widgets of a column-direction container directly in its parent', () => {
    expect(columns.children![1]!.children!.map((child) => child.name)).toEqual([
      'block-heading',
      'block-icon-box',
    ])
  })

  it('reports the roundings', () => {
    expect(ctx.report.roundings).toEqual(
      expect.arrayContaining([
        'section padding: 45px and 20px became md',
        'column gap: 20px became sm',
        'border radius: 10px became md',
        'box shadow: blur 10px became md',
      ])
    )
  })

  it('keeps a row on a phone when the container says so', () => {
    const { nodes: kept } = convert([
      container({ flex_direction: 'row', flex_direction_mobile: 'row' }, [
        container({}, [widget('spacer')], true),
        container({}, [widget('spacer')], true),
      ]),
    ])

    expect(kept[0]!.children![0]!.props.stack).toBe('never')
  })

  it('wraps each widget of a row of widgets in a column', () => {
    const { nodes: row } = convert([
      container({ flex_direction: 'row' }, [
        widget('spacer'),
        widget('spacer'),
      ]),
    ])

    expect(
      row[0]!.children![0]!.children!.map((column) => column.name)
    ).toEqual(['block-column', 'block-column'])
  })

  it('does not make columns from a row with one child', () => {
    const { nodes: one } = convert([
      container({ flex_direction: 'row' }, [widget('spacer')]),
    ])

    expect(one[0]!.children!.map((child) => child.name)).toEqual([
      'block-spacer',
    ])
  })

  it('wraps a styled column-direction container in a single column', () => {
    const { nodes: styled } = convert([
      container({}, [
        container(
          { background_background: 'classic', background_color: '#EEEEEE' },
          [widget('spacer')],
          true
        ),
      ]),
    ])

    expect(styled[0]!.children![0]).toMatchObject({
      name: 'block-columns',
      children: [{ name: 'block-column', props: { bg: '#EEEEEE' } }],
    })
  })
})

describe('a legacy section', () => {
  const { nodes } = convert([HOME_ELEMENTS[3]!])
  const [section] = nodes

  it('becomes a block-section, full width for a full width layout', () => {
    expect(section!.props).toMatchObject({
      bg: '#111111',
      padding: 'lg',
      width: 'full',
    })
  })

  it('turns its columns into block-columns with the inline size as the width', () => {
    const columns = section!.children![0]!

    expect(columns.name).toBe('block-columns')
    expect(columns.props.gap).toBe('lg')
    expect(columns.children!.map((column) => column.props.width)).toEqual([
      '33.33',
      '66.66',
    ])
    expect(columns.children![0]!.props.valign).toBe('center')
  })

  it('turns an inner section into columns inside the column', () => {
    const second = section!.children![0]!.children![1]!
    const inner = second.children![1]!

    expect(second.children![0]!.name).toBe('block-text')
    expect(inner.name).toBe('block-columns')
    expect(inner.children!.map((column) => column.props.width)).toEqual([
      '50',
      '50',
    ])
  })

  it('puts a single column directly in the section', () => {
    const { nodes: single } = convert([
      {
        id: 's',
        elType: 'section',
        settings: {},
        elements: [
          {
            id: 'c',
            elType: 'column',
            settings: { _column_size: 100 },
            elements: [widget('spacer')],
          },
        ],
      },
    ])

    expect(single[0]!.children!.map((child) => child.name)).toEqual([
      'block-spacer',
    ])
  })
})

describe('the MDC of a layout', () => {
  it('has more colons on a block than on the blocks inside it', () => {
    const mdc = serializeBlocks(convert([HOME_ELEMENTS[1]!]).nodes)

    expect(mdc).toMatch(/^:::::block-section/)
    expect(mdc).toContain('\n::::block-columns{gap="sm" valign="center"}\n')
    expect(mdc).toContain('\n:::block-column{width="40"}\n')
    expect(mdc).toContain('\n::block-image{')
  })
})
