import type { ConvertContext, ElementorElement } from '../src/types'
import { Buffer } from 'node:buffer'
import { emptyKit } from '../src/theme'
import { emptyReport } from '../src/types'

export const PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64'
  )
)

export type PhpInput =
  null | boolean | number | string | PhpInput[] | { [key: string]: PhpInput }

export function phpSerialize(value: PhpInput): string {
  if (value === null) {
    return 'N;'
  }

  if (typeof value === 'boolean') {
    return `b:${value ? 1 : 0};`
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? `i:${value};` : `d:${value};`
  }

  if (typeof value === 'string') {
    return `s:${Buffer.byteLength(value)}:"${value}";`
  }

  const entries: [string | number, PhpInput][] = Array.isArray(value)
    ? value.map((entry, index) => [index, entry])
    : Object.entries(value)
  const body = entries
    .map(
      ([key, entry]) => `${phpSerialize(key as PhpInput)}${phpSerialize(entry)}`
    )
    .join('')

  return `a:${entries.length}:{${body}}`
}

export interface PostInput {
  id: number
  type: string
  status?: string
  title: string
  slug?: string
  parent?: number
  link?: string
  date?: string
  excerpt?: string
  content?: string
  attachmentUrl?: string
  menuOrder?: number
  categories?: { domain: string; slug: string; name: string }[]
  meta?: Record<string, string>
}

function cdata(value: string): string {
  return `<![CDATA[${value}]]>`
}

export interface TermInput {
  id: number
  taxonomy: string
  slug: string
  name: string
}

export function termsOf(terms: TermInput[]): string {
  return terms
    .map(
      (term) =>
        `<wp:term><wp:term_id>${term.id}</wp:term_id><wp:term_taxonomy>${term.taxonomy}</wp:term_taxonomy><wp:term_slug>${cdata(term.slug)}</wp:term_slug><wp:term_name>${cdata(term.name)}</wp:term_name></wp:term>`
    )
    .join('\n')
}

export function wxrOf(posts: PostInput[], channel = ''): string {
  const items = posts.map((post) => {
    const meta = Object.entries(post.meta ?? {})
      .map(
        ([key, value]) =>
          `<wp:postmeta><wp:meta_key>${cdata(key)}</wp:meta_key><wp:meta_value>${cdata(value)}</wp:meta_value></wp:postmeta>`
      )
      .join('\n')

    const categories = (post.categories ?? [])
      .map(
        (entry) =>
          `<category domain="${entry.domain}" nicename="${entry.slug}">${cdata(entry.name)}</category>`
      )
      .join('\n')

    return `<item>
<title>${post.title}</title>
<link>${post.link ?? `https://old.example.test/${post.slug ?? post.id}/`}</link>
<content:encoded>${cdata(post.content ?? '')}</content:encoded>
<excerpt:encoded>${cdata(post.excerpt ?? '')}</excerpt:encoded>
<wp:post_id>${post.id}</wp:post_id>
<wp:post_date_gmt>${cdata(post.date ?? '2024-01-25 13:34:11')}</wp:post_date_gmt>
<wp:post_name>${cdata(post.slug ?? '')}</wp:post_name>
<wp:status>${cdata(post.status ?? 'publish')}</wp:status>
<wp:post_parent>${post.parent ?? 0}</wp:post_parent>
<wp:menu_order>${post.menuOrder ?? 0}</wp:menu_order>
<wp:post_type>${cdata(post.type)}</wp:post_type>
${post.attachmentUrl ? `<wp:attachment_url>${cdata(post.attachmentUrl)}</wp:attachment_url>` : ''}
${categories}
${meta}
</item>`
  })

  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0"
  xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:wp="http://wordpress.org/export/1.2/">
<channel>
<title>Example</title>
<link>https://old.example.test</link>
<wp:base_site_url>https://old.example.test</wp:base_site_url>
${channel}
${items.join('\n')}
</channel>
</rss>`
}

export function context(
  overrides: Partial<ConvertContext> = {}
): ConvertContext {
  return {
    kit: emptyKit(),
    report: emptyReport(),
    images: new Map(),
    attachments: new Map(),
    baseUrl: 'https://old.example.test',
    fonts: new Map(),
    ...overrides,
  }
}

export function widget(
  widgetType: string,
  settings: Record<string, unknown> = {}
): ElementorElement {
  return {
    id: widgetType,
    elType: 'widget',
    widgetType,
    settings,
    elements: [],
  }
}

export function container(
  settings: Record<string, unknown>,
  elements: ElementorElement[],
  isInner = false
): ElementorElement {
  return { id: 'c', elType: 'container', isInner, settings, elements }
}

export const KIT_SETTINGS: PhpInput = {
  system_colors: [
    { _id: 'primary', title: 'Primary', color: '#EF5777' },
    { _id: 'secondary', title: 'Secondary', color: '#51C9C0' },
    { _id: 'text', title: 'Text', color: '#222F3E' },
    { _id: 'accent', title: 'Accent', color: '#1E90FF' },
  ],
  custom_colors: [{ _id: 'ab12cd3', title: 'Sand', color: '#F5F6F6' }],
  system_typography: [
    {
      _id: 'primary',
      title: 'Primary',
      typography_typography: 'custom',
      typography_font_family: 'Playfair Display',
      typography_font_weight: '600',
    },
    {
      _id: 'secondary',
      title: 'Secondary',
      typography_typography: 'custom',
      typography_font_family: 'Work Sans',
      typography_font_weight: '400',
    },
    {
      _id: 'text',
      title: 'Text',
      typography_typography: 'custom',
      typography_font_family: 'Work Sans',
      typography_font_weight: '400',
    },
  ],
}

const SQUARE = { unit: 'px', top: '', right: '', bottom: '', left: '' }

export const HOME_ELEMENTS: ElementorElement[] = [
  container(
    {
      flex_direction: 'column',
      content_width: 'boxed',
      boxed_width: { unit: 'px', size: 1000 },
      background_background: 'classic',
      background_color: '#000000',
      background_overlay_background: 'classic',
      background_overlay_image: {
        url: 'https://old.example.test/wp-content/uploads/2024/01/hero-bg.jpg',
        id: 11,
      },
      background_overlay_opacity: { unit: 'px', size: 0.64 },
      padding: { ...SQUARE, top: '100', bottom: '100' },
      min_height: { unit: 'vh', size: 60 },
      _element_id: 'top',
      flex_align_items: 'center',
    },
    [
      widget('heading', {
        title: 'Explore <br>Your <b>Travel</b>',
        header_size: 'h1',
        title_color: '#FFFFFF',
        typography_font_family: 'Playfair Display',
        typography_font_size: { unit: 'px', size: 70 },
        typography_font_size_mobile: { unit: 'px', size: 25 },
        align: 'center',
      }),
      widget('text-editor', {
        editor:
          '<p>Discover <strong>your</strong> next trip &amp; <a href="https://old.example.test/about/">learn more</a>.</p><ul><li>One</li><li>Two</li></ul><table><tr><td>cell</td></tr></table>',
        text_color: '#FFFFFF',
        align_mobile: 'center',
      }),
      widget('button', {
        text: 'Book now',
        link: { url: 'https://example.com/book', is_external: 'on' },
        size: 'lg',
        align: 'center',
        selected_icon: { value: 'fas fa-arrow-right', library: 'fa-solid' },
        __globals__: { background_color: 'globals/colors?id=primary' },
      }),
      widget('shortcode', { shortcode: '[contact-form-7 id="12"]' }),
      widget('html', { html: '<div class="promo">\n\n<p>Hi</p>\n\n</div>' }),
      widget('eael-fancy-box', { eael_title: 'Fancy' }),
      widget('nav-menu', {}),
      {
        ...widget('heading', {
          title: 'Hidden',
          hide_desktop: 'hidden-desktop',
        }),
      },
    ]
  ),
  container(
    {
      flex_direction: 'row',
      flex_direction_mobile: 'column',
      flex_gap: { unit: 'px', column: '20', row: '20', size: 20 },
      flex_align_items: 'center',
      background_background: 'classic',
      __globals__: { background_color: 'globals/colors?id=ab12cd3' },
      padding: { ...SQUARE, top: '45', bottom: '20' },
    },
    [
      container(
        { flex_direction: 'column', width: { unit: '%', size: '40' } },
        [
          widget('image', {
            image: {
              url: 'https://old.example.test/wp-content/uploads/2024/01/team.jpg',
              id: 30,
            },
            image_border_radius: {
              unit: 'px',
              top: '20',
              right: '20',
              bottom: '20',
              left: '20',
            },
            link_to: 'custom',
            link: { url: '/team' },
          }),
        ],
        true
      ),
      container(
        {
          flex_direction: 'column',
          width: { unit: '%', size: '60' },
          background_background: 'classic',
          background_color: '#FFFFFF',
          padding: {
            unit: 'px',
            top: '25',
            right: '25',
            bottom: '25',
            left: '25',
          },
          border_radius: {
            unit: 'px',
            top: '10',
            right: '10',
            bottom: '10',
            left: '10',
          },
          box_shadow_box_shadow_type: 'yes',
          box_shadow_box_shadow: {
            horizontal: 0,
            vertical: 0,
            blur: 10,
            spread: 0,
            color: 'rgba(0,0,0,0.5)',
          },
          flex_justify_content: 'center',
        },
        [
          widget('heading', {
            title: 'Why us',
            header_size: 'h3',
            __globals__: { title_color: 'globals/colors?id=secondary' },
          }),
          container(
            { flex_direction: 'column' },
            [
              widget('icon-box', {
                selected_icon: { value: 'fas fa-star', library: 'fa-solid' },
                title_text: 'Quality',
                description_text: 'Only the best.',
                position: 'left',
                title_size: 'h4',
              }),
            ],
            true
          ),
        ],
        true
      ),
    ]
  ),
  container({ flex_direction: 'column' }, [
    widget('accordion', {
      tabs: [
        { _id: 'a', tab_title: 'Is it free?', tab_content: '<p>Yes.</p>' },
        {
          _id: 'b',
          tab_title: 'Can I cancel?',
          tab_content: '<p>Any time.</p>',
        },
      ],
    }),
    widget('toggle', {
      tabs: [{ _id: 'c', tab_title: 'More', tab_content: '<p>Text</p>' }],
    }),
    widget('testimonial', {
      testimonial_content: 'It took one afternoon.',
      testimonial_name: 'Ana Souza',
      testimonial_job: 'Founder',
      testimonial_image: {
        url: 'https://old.example.test/wp-content/uploads/ana.png',
        id: 13,
      },
      testimonial_alignment: 'center',
    }),
    widget('counter', {
      ending_number: '1,250',
      suffix: '+',
      title: 'Trips',
    }),
    widget('social-icons', {
      shape: 'circle',
      social_icon_list: [
        {
          social_icon: { value: 'fab fa-facebook', library: 'fa-brands' },
          link: { url: 'https://facebook.com/example' },
        },
        {
          social_icon: { value: 'fab fa-tiktok', library: 'fa-brands' },
          link: { url: 'https://tiktok.com/@example' },
        },
      ],
    }),
    widget('image-gallery', {
      wp_gallery: [
        { id: 14, url: 'https://old.example.test/wp-content/uploads/g1.jpg' },
        { id: 15, url: 'https://old.example.test/wp-content/uploads/g2.jpg' },
      ],
      gallery_columns: '2',
    }),
    widget('video', {
      video_type: 'youtube',
      youtube_url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
      aspect_ratio: '43',
    }),
    widget('divider', {
      style: 'dashed',
      weight: { unit: 'px', size: 2 },
      width: { unit: '%', size: 40 },
      gap: { unit: 'px', size: 30 },
    }),
    widget('spacer', { space: { unit: 'px', size: 48 } }),
    widget('icon', {
      selected_icon: { value: 'fas fa-heart', library: 'fa-solid' },
      size: { unit: 'px', size: 48 },
      align: 'center',
    }),
    widget('icon-list', {
      icon_list: [
        {
          _id: 'i1',
          text: 'Free shipping',
          selected_icon: { value: 'fas fa-check', library: 'fa-solid' },
        },
        {
          _id: 'i2',
          text: 'Rated 5 stars',
          selected_icon: { value: 'fas fa-star', library: 'fa-solid' },
          link: { url: '/reviews' },
        },
        {
          _id: 'i3',
          text: 'Odd one',
          selected_icon: { value: 'fas fa-unknown-thing', library: 'fa-solid' },
        },
      ],
    }),
    widget('image-box', {
      image: {
        url: 'https://old.example.test/wp-content/uploads/loaf.jpg',
        id: 16,
      },
      title_text: 'Sourdough',
      description_text: 'Baked every morning.',
      position: 'top',
    }),
  ]),
  {
    id: 's',
    elType: 'section',
    settings: {
      layout: 'full_width',
      gap: 'wide',
      background_background: 'classic',
      background_color: '#111111',
      padding: { ...SQUARE, top: '40', bottom: '40' },
    },
    elements: [
      {
        id: 'col1',
        elType: 'column',
        settings: {
          _column_size: 33,
          _inline_size: 33.33,
          content_position: 'center',
        },
        elements: [widget('heading', { title: 'Left', header_size: 'h2' })],
      },
      {
        id: 'col2',
        elType: 'column',
        settings: { _column_size: 66, _inline_size: 66.66 },
        elements: [
          widget('text-editor', { editor: '<p>Right</p>' }),
          {
            id: 'inner',
            elType: 'section',
            isInner: true,
            settings: {},
            elements: [
              {
                id: 'ic1',
                elType: 'column',
                settings: { _column_size: 50 },
                elements: [
                  widget('spacer', { space: { unit: 'px', size: 20 } }),
                ],
              },
              {
                id: 'ic2',
                elType: 'column',
                settings: { _column_size: 50 },
                elements: [
                  widget('button', { text: 'Go', link: { url: '/go' } }),
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]

export const SIMPLE = JSON.stringify([
  {
    id: 'a',
    elType: 'container',
    settings: {},
    elements: [widget('heading', { title: 'Hello', header_size: 'h1' })],
  },
])

export const SITE = wxrOf(
  [
    {
      id: 1,
      type: 'elementor_library',
      title: 'Default Kit',
      slug: 'default-kit',
      meta: {
        _elementor_template_type: 'kit',
        _elementor_page_settings: phpSerialize(KIT_SETTINGS),
      },
    },
    {
      id: 10,
      type: 'page',
      title: 'Welcome',
      slug: 'home',
      link: 'https://old.example.test/',
      excerpt: '<p>An excerpt.</p>',
      meta: {
        _elementor_data: JSON.stringify(HOME_ELEMENTS),
        _yoast_wpseo_metadesc: 'The home page.',
      },
    },
    {
      id: 11,
      type: 'page',
      title: 'About',
      slug: 'about',
      meta: { _elementor_data: SIMPLE },
    },
    {
      id: 12,
      type: 'page',
      title: 'Our Team',
      slug: 'our-team',
      parent: 11,
      status: 'draft',
      meta: { _elementor_data: SIMPLE },
    },
    { id: 13, type: 'page', title: 'Plain', slug: 'plain' },
    {
      id: 14,
      type: 'page',
      title: 'Gone',
      slug: 'gone',
      status: 'trash',
      meta: { _elementor_data: SIMPLE },
    },
    {
      id: 20,
      type: 'elementor-hf',
      title: 'Header',
      meta: { ehf_template_type: 'type_header', _elementor_data: SIMPLE },
    },
    {
      id: 21,
      type: 'elementor-hf',
      title: 'Footer',
      meta: { ehf_template_type: 'type_footer', _elementor_data: SIMPLE },
    },
    {
      id: 22,
      type: 'elementor_library',
      title: 'Saved',
      meta: { _elementor_template_type: 'page', _elementor_data: SIMPLE },
    },
    {
      id: 23,
      type: 'post',
      title: 'A post',
      meta: { _elementor_data: SIMPLE },
    },
    {
      id: 30,
      type: 'attachment',
      title: 'team',
      attachmentUrl:
        'https://old.example.test/wp-content/uploads/2024/01/team.jpg',
      meta: { _wp_attachment_image_alt: 'The team' },
    },
  ],
  ''
)
