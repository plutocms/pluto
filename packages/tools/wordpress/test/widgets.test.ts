import { describe, expect, it } from 'vitest'
import { serializeBlocks } from '../src/mdc'
import { widgetNodes } from '../src/widgets'
import { context, widget } from './fixtures'

function run(type: string, settings: Record<string, unknown>) {
  const ctx = context()
  const nodes = widgetNodes(ctx, widget(type, settings))

  return { ctx, nodes, mdc: serializeBlocks(nodes) }
}

describe('heading', () => {
  it('maps the level, the color token, the align and the size', () => {
    const { nodes, ctx } = run('heading', {
      title: 'Hello <b>world</b>',
      header_size: 'h3',
      align: 'center',
      typography_font_size: { unit: 'px', size: 36 },
      __globals__: { title_color: 'globals/colors?id=primary' },
    })

    expect(nodes).toEqual([
      {
        name: 'block-heading',
        props: { level: '3', size: 'lg', align: 'center', color: 'primary' },
        text: 'Hello **world**',
      },
    ])
    expect(ctx.report.roundings).toEqual([])
  })

  it('defaults to h2 and keeps the default size when the font size is near it', () => {
    const { nodes } = run('heading', {
      title: 'A title',
      typography_font_size: { unit: 'px', size: 42 },
    })

    expect(nodes[0]!.props).toMatchObject({ level: '2' })
    expect(nodes[0]!.props.size).toBeUndefined()
  })

  it('writes a line break as a space and a link around the text', () => {
    const { nodes } = run('heading', {
      title: 'Line one<br>line two',
      link: { url: 'https://example.com' },
    })

    expect(nodes[0]!.text).toBe('[Line one line two](https://example.com)')
  })

  it('writes a div or a span as a text block', () => {
    const { nodes } = run('heading', { title: 'Small', header_size: 'span' })

    expect(nodes[0]!.name).toBe('block-text')
  })

  it('reports a font that is not in the kit, and not one that is', () => {
    const ctx = context()
    const kit = { ...ctx.kit, headingFont: 'Playfair Display' }

    widgetNodes(
      { ...ctx, kit },
      widget('heading', {
        title: 'A',
        typography_font_family: 'Playfair Display',
      })
    )
    widgetNodes(
      { ...ctx, kit },
      widget('heading', { title: 'B', typography_font_family: 'Lobster' })
    )

    expect(ctx.report.notes).toEqual([
      'Font family "Lobster" is not kept on a block.',
    ])
    expect([...ctx.fonts.keys()]).toEqual(['Playfair Display', 'Lobster'])
  })

  it('skips a heading with no title', () => {
    expect(run('heading', {}).nodes).toEqual([])
  })
})

describe('text-editor', () => {
  it('turns HTML into Markdown', () => {
    const { nodes } = run('text-editor', {
      editor:
        '<h2>Title</h2><p>Some <strong>bold</strong> and <em>italic</em> with a <a href="/x">link</a>.</p><ul><li>One</li><li>Two</li></ul>',
      text_color: '#333333',
      align: 'right',
    })

    expect(nodes[0]!.props).toMatchObject({ color: '#333333', align: 'end' })
    expect(nodes[0]!.text).toBe(
      '## Title\n\nSome **bold** and _italic_ with a [link](/x).\n\n- One\n- Two'
    )
  })

  it('keeps a table as HTML and reports it', () => {
    const { nodes, ctx } = run('text-editor', {
      editor: '<table><tr><td>cell</td></tr></table>',
    })

    expect(nodes[0]!.text).toContain('<table>')
    expect(ctx.report.notes[0]).toContain('stays as HTML')
  })

  it('collects the images and the shortcodes of a text', () => {
    const { ctx } = run('text-editor', {
      editor:
        '<p><img src="https://old.example.test/a.jpg" alt="x"></p><p>[gallery ids="1,2"]</p>',
    })

    expect([...ctx.images.keys()]).toEqual(['https://old.example.test/a.jpg'])
    expect(ctx.report.shortcodes).toEqual(['[gallery ids="1,2"]'])
  })

  it('does not take a Markdown link for a shortcode', () => {
    const { ctx } = run('text-editor', {
      editor: '<p>See [this](http://a.b) now</p>',
    })

    expect(ctx.report.shortcodes).toEqual([])
  })

  it('skips an empty text', () => {
    expect(run('text-editor', { editor: '<p>&nbsp;</p>' }).nodes).toEqual([])
  })
})

describe('image', () => {
  it('maps the image, the alt of the attachment, the link and the radius', () => {
    const ctx = context({
      attachments: new Map([
        [5, { url: 'https://old.example.test/u/pic.jpg', alt: 'A picture' }],
      ]),
    })
    const nodes = widgetNodes(
      ctx,
      widget('image', {
        image: { id: 5, url: '' },
        link_to: 'custom',
        link: { url: '/more', is_external: 'on' },
        image_border_radius: {
          unit: 'px',
          top: '8',
          right: '8',
          bottom: '8',
          left: '8',
        },
        width: { unit: '%', size: 50 },
        align: 'center',
        caption_source: 'custom',
        caption: 'Caption',
      })
    )

    expect(nodes[0]).toEqual({
      name: 'block-image',
      props: {
        src: 'https://old.example.test/u/pic.jpg',
        alt: 'A picture',
        caption: 'Caption',
        width: '50%',
        radius: 'md',
        align: 'center',
        link: '/more',
        target: '_blank',
      },
    })
    expect(ctx.images.get('https://old.example.test/u/pic.jpg')).toBe(
      'A picture'
    )
  })

  it('counts an image with no alt', () => {
    const { ctx, mdc } = run('image', {
      image: { url: 'https://a.test/x.png' },
    })

    expect(ctx.report.missingAlt).toBe(1)
    expect(mdc).toContain('alt=""')
  })

  it('skips the placeholder image and a missing image', () => {
    expect(
      run('image', {
        image: {
          url: 'https://a.test/wp-content/plugins/elementor/assets/images/placeholder.png',
        },
      }).nodes
    ).toEqual([])
    expect(run('image', {}).nodes).toEqual([])
  })
})

describe('button', () => {
  it('maps the label, the link, the size, the color and the icon', () => {
    const { nodes } = run('button', {
      text: 'Book',
      link: { url: 'https://example.com', is_external: 'on' },
      size: 'lg',
      align: 'center',
      selected_icon: { value: 'fas fa-arrow-right' },
      __globals__: { background_color: 'globals/colors?id=secondary' },
    })

    expect(nodes[0]).toEqual({
      name: 'block-button',
      props: {
        label: 'Book',
        link: 'https://example.com',
        target: '_blank',
        size: 'lg',
        align: 'center',
        color: 'secondary',
        icon: 'i-lucide-arrow-right',
      },
    })
  })

  it('writes a button with a border and no fill as an outline', () => {
    const { nodes } = run('button', {
      text: 'Go',
      border_border: 'solid',
      border_color: '#ff0000',
    })

    expect(nodes[0]!.props).toMatchObject({
      variant: 'outline',
      color: '#ff0000',
    })
  })

  it('writes a justified button as a full button', () => {
    expect(
      run('button', { text: 'Go', align: 'justify' }).nodes[0]!.props
    ).toMatchObject({
      full: true,
    })
  })
})

describe('icon', () => {
  it('maps the icon, the size and the color', () => {
    const { nodes } = run('icon', {
      selected_icon: { value: 'fas fa-heart' },
      size: { unit: 'px', size: 50 },
      primary_color: '#ff0000',
      align: 'center',
    })

    expect(nodes[0]).toEqual({
      name: 'block-icon',
      props: {
        icon: 'i-lucide-heart',
        size: 'xl',
        color: '#ff0000',
        align: 'center',
        link: undefined,
        target: undefined,
        label: undefined,
      },
    })
  })

  it('reports an icon with no match, and uses the default', () => {
    const { nodes, ctx } = run('icon', {
      selected_icon: { value: 'fas fa-nothing-here' },
    })

    expect(nodes[0]!.props.icon).toBe('i-lucide-circle')
    expect(ctx.report.unmappedIcons).toEqual(['fas fa-nothing-here (icon)'])
  })
})

describe('icon-list', () => {
  it('puts the common icon on the list and the odd ones on their items', () => {
    const { nodes, ctx } = run('icon-list', {
      icon_list: [
        { text: 'One', selected_icon: { value: 'fas fa-star' } },
        {
          text: 'Two',
          selected_icon: { value: 'fas fa-star' },
          link: { url: '/two' },
        },
        { text: 'Three', selected_icon: { value: 'fas fa-heart' } },
        { text: 'Four', selected_icon: { value: 'fas fa-mystery' } },
      ],
      view: 'inline',
      space_between: { unit: 'px', size: 16 },
    })
    const [list] = nodes

    expect(list!.props).toMatchObject({
      icon: 'i-lucide-star',
      layout: 'inline',
      gap: 'sm',
    })
    expect(list!.children!.map((item) => item.props.icon)).toEqual([
      undefined,
      undefined,
      'i-lucide-heart',
      'i-lucide-circle',
    ])
    expect(list!.children![1]!.props.link).toBe('/two')
    expect(ctx.report.unmappedIcons).toHaveLength(1)
  })

  it('escapes the characters of Markdown in an item', () => {
    const { nodes } = run('icon-list', {
      icon_list: [
        { text: '2 * 3 _x_', selected_icon: { value: 'fas fa-check' } },
      ],
    })

    expect(nodes[0]!.children![0]!.text).toBe('2 \\* 3 \\_x\\_')
  })
})

describe('icon-box and image-box', () => {
  it('maps an icon box', () => {
    const { nodes } = run('icon-box', {
      selected_icon: { value: 'fas fa-star' },
      title_text: 'Quality',
      description_text: 'Only <b>the best</b>.',
      position: 'right',
      title_size: 'h4',
      link: { url: '/q' },
    })

    expect(nodes[0]).toMatchObject({
      name: 'block-icon-box',
      props: {
        icon: 'i-lucide-star',
        title: 'Quality',
        level: '4',
        position: 'left',
        link: '/q',
      },
      text: 'Only **the best**.',
    })
  })

  it('maps an image box and uses the title as the alt', () => {
    const { nodes, ctx } = run('image-box', {
      image: { url: 'https://a.test/b.jpg' },
      title_text: 'Bread',
      description_text: 'Fresh.',
    })

    expect(nodes[0]!.props).toMatchObject({
      src: 'https://a.test/b.jpg',
      alt: 'Bread',
      title: 'Bread',
    })
    expect(ctx.report.missingAlt).toBe(0)
  })
})

describe('accordion and toggle', () => {
  const tabs = [
    { tab_title: 'Q1', tab_content: '<p>A1</p>' },
    { tab_title: 'Q2', tab_content: '<p>A2</p>' },
  ]

  it('maps an accordion to one open item at a time', () => {
    const { nodes } = run('accordion', { tabs })

    expect(nodes[0]!.props).toEqual({ single: true })
    expect(nodes[0]!.children!.map((item) => item.props.title)).toEqual([
      'Q1',
      'Q2',
    ])
    expect(nodes[0]!.children![0]!.text).toBe('A1')
  })

  it('maps a toggle to an accordion that opens many items', () => {
    expect(run('toggle', { tabs }).nodes[0]!.props.single).toBeUndefined()
  })
})

describe('testimonial, counter and social icons', () => {
  it('maps a testimonial', () => {
    const { nodes } = run('testimonial', {
      testimonial_content: 'Great.',
      testimonial_name: 'Ana',
      testimonial_job: 'Founder',
      testimonial_image: { url: 'https://a.test/ana.png' },
      testimonial_alignment: 'center',
    })

    expect(nodes[0]).toMatchObject({
      name: 'block-testimonial',
      props: {
        name: 'Ana',
        role: 'Founder',
        image: 'https://a.test/ana.png',
        align: 'center',
      },
      text: 'Great.',
    })
  })

  it('maps a counter, with a number that has a thousands separator', () => {
    expect(
      run('counter', { ending_number: '1,250', suffix: '+', title: 'Trips' })
        .nodes[0]
    ).toMatchObject({
      name: 'block-counter',
      props: { value: 1250, suffix: '+', title: 'Trips' },
    })
  })

  it('writes a counter with no number as a placeholder', () => {
    const { nodes, ctx } = run('counter', { ending_number: 'many' })

    expect(nodes[0]!.name).toBe('block-text')
    expect(ctx.report.placeholders).toHaveLength(1)
  })

  it('maps social icons to networks, and reports a network the kit has not', () => {
    const { nodes, ctx } = run('social-icons', {
      shape: 'rounded',
      social_icon_list: [
        {
          social_icon: { value: 'fab fa-instagram' },
          link: { url: 'https://instagram.com/x' },
        },
        {
          social_icon: { value: 'fab fa-tiktok' },
          link: { url: 'https://tiktok.com/@x' },
        },
        { social_icon: { value: 'fab fa-github' }, link: { url: '' } },
      ],
    })

    expect(nodes[0]!.props.shape).toBe('square')
    expect(nodes[0]!.children!.map((link) => link.props.network)).toEqual([
      'instagram',
      'website',
    ])
    expect(ctx.report.unmappedIcons).toEqual(['fab fa-tiktok (social icons)'])
  })
})

describe('gallery, video, divider and spacer', () => {
  it('maps a gallery to block images', () => {
    const { nodes } = run('image-gallery', {
      wp_gallery: [
        { url: 'https://a.test/1.jpg' },
        { url: 'https://a.test/2.jpg' },
      ],
      gallery_columns: '9',
    })

    expect(nodes[0]!.props.columns).toBe(6)
    expect(nodes[0]!.children!.map((image) => image.name)).toEqual([
      'block-image',
      'block-image',
    ])
  })

  it('maps a YouTube video, and says that a hosted video is a link', () => {
    expect(
      run('video', {
        youtube_url: 'https://www.youtube.com/watch?v=abc',
        aspect_ratio: '219',
      }).nodes[0]!.props
    ).toEqual({ url: 'https://www.youtube.com/watch?v=abc', ratio: '21:9' })

    const hosted = run('video', {
      video_type: 'hosted',
      hosted_url: { url: 'https://a.test/v.mp4' },
    })

    expect(hosted.nodes[0]!.props.url).toBe('https://a.test/v.mp4')
    expect(hosted.ctx.report.notes[0]).toContain('renders as a link')
  })

  it('maps a divider', () => {
    expect(
      run('divider', {
        style: 'dotted',
        weight: { unit: 'px', size: 3 },
        width: { unit: '%', size: 30 },
        gap: { unit: 'px', size: 48 },
        align: 'left',
      }).nodes[0]!.props
    ).toMatchObject({
      line: 'dotted',
      thickness: 3,
      width: '30%',
      spacing: 'lg',
      align: 'start',
    })
  })

  it('keeps the length of a spacer, because the block takes a length', () => {
    expect(
      run('spacer', { space: { unit: 'px', size: 37 } }).nodes[0]!.props.size
    ).toBe('37px')
    expect(run('spacer', {}).nodes[0]!.props.size).toBe('50px')
  })
})

describe('html, shortcode and unknown widgets', () => {
  it('keeps raw HTML without blank lines, and reports a script', () => {
    const { mdc, ctx } = run('html', {
      html: '<div>\n\n<p>Hi</p>\n\n<script>1</script></div>',
    })

    expect(mdc).toBe('<div>\n<p>Hi</p>\n<script>1</script></div>')
    expect(ctx.report.rawHtml[0]).toContain('renderer removes it')
  })

  it('writes a shortcode as a placeholder', () => {
    const { mdc, ctx } = run('shortcode', {
      shortcode: '[contact-form-7 id="1"]',
    })

    expect(mdc).toBe(
      '::block-text\nNot imported: the shortcode `[contact-form-7 id="1"]`.\n::'
    )
    expect(ctx.report.shortcodes).toEqual(['[contact-form-7 id="1"]'])
    expect(ctx.report.placeholders).toEqual([
      'shortcode [contact-form-7 id="1"]',
    ])
  })

  it('writes any other widget as a placeholder and counts it', () => {
    const ctx = context()

    widgetNodes(ctx, widget('nav-menu'))
    const nodes = widgetNodes(ctx, widget('nav-menu'))

    expect(nodes[0]!.text).toBe(
      'Not imported: the Elementor widget "nav-menu".'
    )
    expect(ctx.report.unknownWidgets).toEqual({ 'nav-menu': 2 })
    expect(ctx.report.placeholders).toHaveLength(2)
  })

  it('drops a menu anchor with no placeholder', () => {
    const ctx = context()

    expect(widgetNodes(ctx, widget('menu-anchor'))).toEqual([])
    expect(ctx.report.unknownWidgets).toEqual({ 'menu-anchor': 1 })
  })
})
