import type {
  PlutoBlock,
  PlutoComponentBlock,
} from '../../../core/shared/utils/blocks/types'
import type { PostInput } from './fixtures'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseBlocks } from '../../../core/shared/utils/blocks/parse'
import { parseMarkdownFile } from '../src/files'
import { runImport } from '../src/import'
import { readMenus } from '../src/menus'
import { pagePaths } from '../src/pages'
import { readWxr } from '../src/wxr'
import { container, phpSerialize, SIMPLE, termsOf, widget, wxrOf } from './fixtures'

const NOW = new Date('2026-11-16T10:00:00Z')

const TERMS = termsOf([
  { id: 44, taxonomy: 'nav_menu', slug: 'primary', name: 'Primary' },
  { id: 45, taxonomy: 'nav_menu', slug: 'quick-links', name: 'Quick Links' },
  { id: 46, taxonomy: 'nav_menu', slug: 'unused', name: 'Unused' },
  { id: 7, taxonomy: 'category', slug: 'trips', name: 'Trips' },
])

const PAGES: PostInput[] = [
  {
    id: 10,
    type: 'page',
    title: 'Welcome',
    slug: 'home',
    meta: { _elementor_data: SIMPLE },
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
    meta: { _elementor_data: SIMPLE },
  },
  { id: 13, type: 'page', title: 'Contact', slug: 'contact' },
  { id: 50, type: 'post', title: 'Hello world', slug: 'hello-world' },
]

function item(
  id: number,
  menu: string,
  order: number,
  meta: Record<string, string>,
  title = ''
): PostInput {
  return {
    id,
    type: 'nav_menu_item',
    title,
    slug: String(id),
    menuOrder: order,
    categories: [{ domain: 'nav_menu', slug: menu, name: menu }],
    meta: {
      _menu_item_menu_item_parent: '0',
      _menu_item_url: '',
      _menu_item_target: '',
      ...meta,
    },
  }
}

function pageItem(
  id: number,
  menu: string,
  order: number,
  pageId: number,
  extra: Record<string, string> = {},
  title = ''
): PostInput {
  return item(
    id,
    menu,
    order,
    {
      _menu_item_type: 'post_type',
      _menu_item_object: 'page',
      _menu_item_object_id: String(pageId),
      ...extra,
    },
    title
  )
}

const ITEMS: PostInput[] = [
  pageItem(104, 'primary', 4, 12, { _menu_item_menu_item_parent: '102' }),
  pageItem(100, 'primary', 1, 10),
  pageItem(102, 'primary', 3, 11, {}, 'About us'),
  item(
    103,
    'primary',
    6,
    {
      _menu_item_type: 'custom',
      _menu_item_object: 'custom',
      _menu_item_url: 'https://old.example.test/blog/',
      _menu_item_target: '_blank',
    },
    'Blog'
  ),
  item(
    101,
    'primary',
    2,
    {
      _menu_item_type: 'custom',
      _menu_item_object: 'custom',
      _menu_item_url: 'https://docs.example.org/guide',
    },
    'Docs'
  ),
  item(105, 'primary', 7, {
    _menu_item_type: 'taxonomy',
    _menu_item_object: 'category',
    _menu_item_object_id: '7',
  }),
  item(106, 'primary', 8, {
    _menu_item_type: 'post_type',
    _menu_item_object: 'post',
    _menu_item_object_id: '50',
  }),
  pageItem(107, 'primary', 9, 13),
  pageItem(108, 'primary', 10, 999),
  item(
    109,
    'primary',
    5,
    {
      _menu_item_type: 'custom',
      _menu_item_object: 'custom',
      _menu_item_url: '#',
    },
    'Parent only'
  ),
  pageItem(200, 'quick-links', 1, 11),
  pageItem(201, 'quick-links', 2, 12),
]

const LOGO = {
  url: 'https://old.example.test/wp-content/uploads/logo.png',
  id: 0,
}

const FOOTER_ELEMENTS = [
  container({}, [
    widget('site-logo', { custom_image: LOGO }),
    widget('navigation-menu', { menu: 'quick-links' }),
    widget('copyright', {
      shortcode: 'Copyright © [hfe_current_year] [hfe_site_title]',
      align: 'center',
    }),
  ]),
]

const HEADER_ELEMENTS = [
  container({}, [
    widget('site-logo', { custom_image: LOGO }),
    widget('navigation-menu', { menu: 'quick-links' }),
  ]),
]

function footerPost(type: 'hf' | 'pro', id = 300): PostInput {
  return type === 'hf'
    ? {
        id,
        type: 'elementor-hf',
        title: 'Footer',
        meta: {
          ehf_template_type: 'type_footer',
          _elementor_data: JSON.stringify(FOOTER_ELEMENTS),
        },
      }
    : {
        id,
        type: 'elementor_library',
        title: 'Pro footer',
        meta: {
          _elementor_template_type: 'footer',
          _elementor_data: JSON.stringify(FOOTER_ELEMENTS),
        },
      }
}

const HEADER: PostInput = {
  id: 301,
  type: 'elementor-hf',
  title: 'Header',
  meta: {
    ehf_template_type: 'type_header',
    _elementor_data: JSON.stringify(HEADER_ELEMENTS),
  },
}

function site(extra: PostInput[] = []): string {
  return wxrOf([...PAGES, ...ITEMS, ...extra], TERMS)
}

let root: string
let input: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'pluto-wordpress-menus-'))
  input = join(root, 'export.xml')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

const out = () => join(root, 'project')

async function importSite(
  extra: PostInput[] = [],
  options: { dryRun?: boolean, force?: boolean } = {}
) {
  await writeFile(input, site(extra))

  return runImport({
    input,
    out: out(),
    media: false,
    now: () => NOW,
    ...options,
  })
}

async function read(path: string) {
  return parseMarkdownFile(await readFile(join(out(), path), 'utf8'))
}

async function files(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const nested = await Promise.all(
    entries.map(async (entry) =>
      entry.isDirectory()
        ? (await files(join(dir, entry.name))).map(
            (name) => `${entry.name}/${name}`
          )
        : [entry.name]
    )
  )

  return nested.flat().sort()
}

function walk(blocks: PlutoBlock[], visit: (block: PlutoComponentBlock) => void) {
  for (const block of blocks) {
    if (block.kind === 'component') {
      visit(block)

      for (const slot of Object.values(block.slots)) {
        walk(slot, visit)
      }
    }
  }
}

describe('the menus', () => {
  it('writes one file per menu, with the title and the WordPress id', async () => {
    const result = await importSite()

    expect(await files(join(out(), 'content/menus'))).toEqual([
      'main.md',
      'quick-links.md',
    ])
    expect((await read('content/menus/main.md')).frontmatter).toEqual({
      title: 'Primary',
      wordpress: { id: 44 },
    })
    expect(result.menus.map((menu) => menu.handle)).toEqual([
      'main',
      'quick-links',
    ])
  })

  it('writes the items in menu order, with children inside their parent', async () => {
    await importSite()

    const { body } = await read('content/menus/main.md')

    expect(body).toBe(
      [
        '',
        '::menu-item{label="Welcome" link="/"}',
        '::',
        '',
        '::menu-item{label="Docs" link="https://docs.example.org/guide"}',
        '::',
        '',
        ':::menu-item{label="About us" link="/about"}',
        '::menu-item{label="Our Team" link="/about/our-team"}',
        '::',
        ':::',
        '',
        '::menu-item{label="Parent only"}',
        '::',
        '',
        '::menu-item{label="Blog" link="/blog" target="_blank"}',
        '::',
        '',
        '::menu-item{label="Trips"}',
        '::',
        '',
        '::menu-item{label="Hello world" link="/posts/hello-world"}',
        '::',
        '',
        '::menu-item{label="Contact" link="/contact"}',
        '::',
        '',
      ].join('\n')
    )
  })

  it('uses the title of the page when the item has no title', async () => {
    await importSite()

    expect((await read('content/menus/quick-links.md')).body).toContain(
      'label="About" link="/about"'
    )
  })

  it('rewrites a link to the old site as a path and keeps another host', async () => {
    await importSite()

    const { body } = await read('content/menus/main.md')

    expect(body).toContain('link="/blog"')
    expect(body).not.toContain('old.example.test')
    expect(body).toContain('https://docs.example.org/guide')
  })

  it('reports the taxonomy item, the post, the missing page and the page that was not imported', async () => {
    const result = await importSite()
    const main = result.menus.find((menu) => menu.handle === 'main')!

    expect(main.items).toBe(9)
    expect(main.unmapped.join('\n')).toContain('archive of the taxonomy "category"')
    expect(main.unmapped.join('\n')).toContain('does not import posts')
    expect(main.unmapped.join('\n')).toContain('was not imported')
    expect(main.unmapped.join('\n')).toContain('Item 108 has no title')
    expect(result.report).toContain('## Menus')
    expect(result.report).toContain('became `main`')
    expect(result.report).toContain('Menus with no item (not imported): "Unused"')
  })

  it('writes menu bodies that parse with the block parser of core and hold only menu-item blocks', async () => {
    await importSite()

    for (const name of ['main', 'quick-links']) {
      const names: string[] = []

      walk(
        parseBlocks((await read(`content/menus/${name}.md`)).body).blocks,
        (block) => names.push(block.name)
      )

      expect(names.length).toBeGreaterThan(1)
      expect(new Set(names)).toEqual(new Set(['menu-item']))
    }
  })

  it('keeps the other menus under their slugified name', async () => {
    const wxr = readWxr(
      wxrOf(
        [
          ...PAGES,
          pageItem(1, 'primary', 1, 10),
          pageItem(2, 'side', 1, 10),
          pageItem(3, 'side', 2, 11),
        ],
        termsOf([
          { id: 1, taxonomy: 'nav_menu', slug: 'primary', name: 'Primary' },
          { id: 2, taxonomy: 'nav_menu', slug: 'side', name: 'Side Bar & Co' },
        ])
      )
    )
    const plan = readMenus(wxr, pagePaths(wxr.posts, undefined), new Set())

    expect(plan.menus.map((menu) => menu.handle)).toEqual([
      'main',
      'side-bar-co',
    ])
  })
})

describe('the choice of the main menu', () => {
  const terms = (...slugs: string[]) =>
    termsOf(
      slugs.map((slug, index) => ({
        id: index + 1,
        taxonomy: 'nav_menu',
        slug,
        name: slug,
      }))
    )

  function plan(slugs: string[], sizes: number[], header?: string) {
    const items = slugs.flatMap((slug, menu) =>
      Array.from({ length: sizes[menu]! }, (_, index) =>
        pageItem(menu * 100 + index + 1, slug, index, 10)
      )
    )
    const wxr = readWxr(wxrOf([...PAGES, ...items], terms(...slugs)))

    return readMenus(wxr, pagePaths(wxr.posts, undefined), new Set(), header)
  }

  it('takes the menu whose slug has primary, main, header or menu-1', () => {
    expect(plan(['a', 'top-menu-1', 'b'], [3, 1, 2]).main).toMatchObject({
      name: 'top-menu-1',
      reason: 'its name or slug contains "menu-1"',
    })
    expect(plan(['a', 'site-header', 'primary'], [1, 1, 1]).main!.name).toBe(
      'primary'
    )
  })

  it('takes the menu of the header navigation widget next', () => {
    expect(plan(['a', 'b', 'c'], [3, 1, 2], 'c').main).toMatchObject({
      name: 'c',
      reason: 'the header navigation widget uses it',
    })
  })

  it('takes the largest menu last', () => {
    expect(plan(['a', 'b', 'c'], [1, 3, 2]).main).toMatchObject({
      name: 'b',
      reason: 'it is the largest menu',
    })
  })

  it('does not pick a menu with no item', () => {
    expect(plan(['primary', 'b'], [0, 2]).main!.name).toBe('b')
  })

  it('has no main menu when no menu has an item', () => {
    expect(plan(['primary'], [0]).main).toBeUndefined()
  })
})

describe('the footer area', () => {
  it('writes the footer of a Header Footer Elementor template', async () => {
    const result = await importSite([footerPost('hf')])
    const footer = await read('content/areas/footer.md')

    expect(result.footer).toMatchObject({
      handle: 'footer',
      action: 'written',
      wordpressId: 300,
    })
    expect(footer.frontmatter).toEqual({
      title: 'Footer',
      wordpress: { id: 300 },
    })
    expect(footer.body).toContain('block-section')
  })

  it('writes the footer of a theme builder template', async () => {
    const result = await importSite([footerPost('pro')])

    expect(result.footer).toMatchObject({
      action: 'written',
      source: 'an Elementor theme builder template',
    })
    expect((await read('content/areas/footer.md')).frontmatter).toEqual({
      title: 'Footer',
      wordpress: { id: 300 },
    })
  })

  it('turns the navigation widget into an icon list of the top-level items of its menu', async () => {
    const result = await importSite([footerPost('hf')])
    const { body } = await read('content/areas/footer.md')

    expect(body).toContain(
      '::block-icon-list{icon="i-lucide-chevron-right" gap="sm"}'
    )
    expect(body).toContain('::block-icon-list-item{link="/about"}\nAbout\n::')
    expect(body).toContain(
      '::block-icon-list-item{link="/about/our-team"}\nOur Team\n::'
    )
    expect(result.footer!.report.notes.join('\n')).toContain(
      'The menu "quick-links" became an icon list'
    )
  })

  it('turns the site logo into an image, and the copyright into text with the year and the site title', async () => {
    await importSite([footerPost('hf')])

    const { body } = await read('content/areas/footer.md')

    expect(body).toContain(
      'src="https://old.example.test/wp-content/uploads/logo.png"'
    )
    expect(body).toContain('Copyright © 2026 Example')
    expect(body).toContain('align="center"')
  })

  it('writes a heading with the site title when the logo has no image', async () => {
    const elements = [container({}, [widget('site-logo'), widget('site-title', { header_size: 'h3' })])]

    const result = await importSite([
      {
        id: 300,
        type: 'elementor-hf',
        title: 'Footer',
        meta: {
          ehf_template_type: 'type_footer',
          _elementor_data: JSON.stringify(elements),
        },
      },
    ])
    const { body } = await read('content/areas/footer.md')

    expect(body).toContain('::block-heading{level="2"}\nExample\n::')
    expect(body).toContain('::block-heading{level="3"}\nExample\n::')
    expect(result.footer!.report.notes.join('\n')).toContain('site title replaced')
  })

  it('keeps a placeholder when the menu of the widget is not in the export', async () => {
    const elements = [container({}, [widget('navigation-menu', { menu: 'gone' })])]
    const result = await importSite([
      {
        id: 300,
        type: 'elementor-hf',
        title: 'Footer',
        meta: {
          ehf_template_type: 'type_footer',
          _elementor_data: JSON.stringify(elements),
        },
      },
    ])

    expect((await read('content/areas/footer.md')).body).toContain(
      'Not imported: the Elementor widget "navigation-menu".'
    )
    expect(result.footer!.report.placeholders).toEqual([
      'widget navigation-menu',
    ])
  })

  it('writes a body that parses with the block parser of core', async () => {
    await importSite([footerPost('hf')])

    const parsed = parseBlocks((await read('content/areas/footer.md')).body)
    const names: string[] = []

    walk(parsed.blocks, (block) => names.push(block.name))

    expect(names).toContain('block-icon-list')
    expect(names).toContain('block-image')
    expect(names).toContain('block-text')
    expect(names.every((name) => name.startsWith('block-'))).toBe(true)
  })

  it('imports the first footer and lists the others', async () => {
    const result = await importSite([footerPost('hf'), footerPost('pro', 302)])

    expect(result.footer!.wordpressId).toBe(300)
    expect(result.others.map((entry) => entry.kind)).toContain('Footer')
  })

  it('has no footer area when the export has no footer', async () => {
    const result = await importSite()

    expect(result.footer).toBeUndefined()
    expect(result.report).toContain('No footer was found in the export.')
    expect(await files(join(out(), 'content'))).not.toContain('areas/footer.md')
  })
})

describe('the header', () => {
  it('is not imported, and the report names its menu and its widgets', async () => {
    const result = await importSite([HEADER, footerPost('hf')])

    expect(await files(join(out(), 'content'))).not.toContain(
      'areas/header.md'
    )
    expect(result.headers).toEqual([
      {
        title: 'Header',
        source: 'Header Footer Elementor',
        menu: 'quick-links',
        mappedTo: 'quick-links',
        widgets: { 'site-logo': 1, 'navigation-menu': 1 },
      },
    ])
    expect(result.report).toContain('## Header')
    expect(result.report).toContain(
      'Its navigation menu "quick-links" is the `quick-links` menu.'
    )
    expect(result.report).toContain('The `main` menu is "Primary"')
    expect(result.report).toContain('Its widgets: site-logo x1, navigation-menu x1')
  })

  it('names the main menu when the header uses it', async () => {
    const header: PostInput = {
      ...HEADER,
      meta: {
        ehf_template_type: 'type_header',
        _elementor_data: JSON.stringify([
          container({}, [widget('navigation-menu', { menu: 'primary' })]),
        ]),
      },
    }
    const result = await importSite([header])

    expect(result.headers[0]!.mappedTo).toBe('main')
    expect(result.report).toContain(
      'Its navigation menu "primary" is the `main` menu.'
    )
  })
})

describe('writing again, and the dry run', () => {
  it('skips a menu and the footer that are already there', async () => {
    await importSite([footerPost('hf')])

    const again = await importSite([footerPost('hf')])

    expect(again.menus.map((menu) => menu.action)).toEqual(['skipped', 'skipped'])
    expect(again.footer!.action).toBe('skipped')
  })

  it('does not write over a file of another WordPress id, unless --force', async () => {
    await importSite([footerPost('hf')])
    await writeFile(
      join(out(), 'content/menus/main.md'),
      '---\ntitle: Mine\nwordpress:\n  id: 1\n---\n\nmine\n'
    )
    await writeFile(
      join(out(), 'content/areas/footer.md'),
      '---\ntitle: Mine\n---\n\nmine\n'
    )

    const again = await importSite([footerPost('hf')])

    expect(again.menus[0]!.action).toBe('conflict')
    expect(again.footer!.action).toBe('conflict')
    expect(await readFile(join(out(), 'content/menus/main.md'), 'utf8')).toContain(
      'mine'
    )

    const forced = await importSite([footerPost('hf')], { force: true })

    expect(forced.menus[0]!.action).toBe('written')
    expect(forced.footer!.action).toBe('written')
    expect((await read('content/menus/main.md')).frontmatter.title).toBe(
      'Primary'
    )
  })

  it('writes nothing on a dry run, and plans the menus and the footer', async () => {
    const result = await importSite([footerPost('hf')], { dryRun: true })

    expect(await files(out())).toEqual([])
    expect(result.menus.map((menu) => menu.action)).toEqual(['planned', 'planned'])
    expect(result.footer!.action).toBe('planned')
    expect(result.report).toContain('- Menus to import: 2')
    expect(result.report).toContain('- Footer area: to import')
  })
})

describe('a menu item with other meta', () => {
  it('reads a menu item whose meta has a serialized value', async () => {
    const post = item(
      1,
      'primary',
      1,
      {
        _menu_item_type: 'custom',
        _menu_item_object: 'custom',
        _menu_item_url: 'https://old.example.test/x/',
        _menu_item_classes: phpSerialize(['']),
      },
      'X'
    )

    await writeFile(
      input,
      wxrOf(
        [post],
        termsOf([
          { id: 1, taxonomy: 'nav_menu', slug: 'primary', name: 'Primary' },
        ])
      )
    )

    await runImport({ input, out: out(), media: false })

    expect((await read('content/menus/main.md')).body).toContain(
      'label="X" link="/x"'
    )
  })
})
