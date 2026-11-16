import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseMarkdownFile } from '../src/files'
import { runImport } from '../src/import'
import { HOME_ELEMENTS, PNG, SIMPLE, SITE, wxrOf } from './fixtures'

const NOW = new Date('2026-11-16T10:00:00Z')

let root: string
let input: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'pluto-wordpress-writer-'))
  input = join(root, 'export.xml')
  await writeFile(input, SITE)
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

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

function pngFetch(calls: string[] = []): typeof fetch {
  return ((url: string) => {
    calls.push(String(url))

    return Promise.resolve(
      new Response(PNG, { headers: { 'content-type': 'image/png' } })
    )
  }) as typeof fetch
}

const out = () => join(root, 'project')

describe('the pages', () => {
  it('writes the pages, the theme and the report', async () => {
    const result = await runImport({
      input,
      out: out(),
      media: false,
      now: () => NOW,
    })

    expect(await files(out())).toEqual([
      'content/pages/about.md',
      'content/pages/about/our-team.md',
      'content/pages/home.md',
      'pluto-import-report.md',
      'pluto-import/theme.json',
    ])
    expect(result.pages.map((page) => page.action)).toEqual([
      'written',
      'written',
      'written',
    ])
  })

  it('makes the front page home, and a child page use the path of its parent', async () => {
    const result = await runImport({ input, out: out(), media: false })

    expect(result.pages.map((page) => page.path)).toEqual([
      'home',
      'about',
      'about/our-team',
    ])
  })

  it('writes the frontmatter: title, status, description, publish date and WordPress id and link', async () => {
    await runImport({ input, out: out(), media: false })

    const home = parseMarkdownFile(
      await readFile(join(out(), 'content/pages/home.md'), 'utf8')
    )
    const team = parseMarkdownFile(
      await readFile(join(out(), 'content/pages/about/our-team.md'), 'utf8')
    )

    expect(home.frontmatter).toEqual({
      title: 'Welcome',
      status: 'published',
      description: 'The home page.',
      layout: 'full',
      publishedAt: '2024-01-25T13:34:11.000Z',
      wordpress: { id: 10, link: 'https://old.example.test/' },
    })
    expect(team.frontmatter.status).toBe('draft')
    expect(team.frontmatter).not.toHaveProperty('publishedAt')
    expect(team.frontmatter.wordpress).toEqual({
      id: 12,
      link: 'https://old.example.test/our-team/',
    })
  })

  it('uses the excerpt when no SEO plugin set a description', async () => {
    const xml = wxrOf([
      {
        id: 5,
        type: 'page',
        title: 'X',
        slug: 'x',
        excerpt: '<p>The <b>excerpt</b>.</p>',
        meta: { _elementor_data: SIMPLE },
      },
    ])

    await writeFile(input, xml)
    await runImport({ input, out: out(), media: false })

    const page = parseMarkdownFile(
      await readFile(join(out(), 'content/pages/x.md'), 'utf8')
    )

    expect(page.frontmatter.description).toBe('The excerpt.')
  })

  it('does not import a plain page, a trashed page, a template, a header, a footer or a post, and lists them', async () => {
    const result = await runImport({ input, out: out(), media: false })
    const kinds = result.others.map((item) => item.kind)

    expect(kinds).toHaveLength(5)
    expect(new Set(kinds)).toEqual(
      new Set([
        'Header',
        'Footer',
        'Elementor template (page)',
        'Elementor content of type "post"',
        'Pages',
      ])
    )
    expect(result.others.find((item) => item.kind === 'Pages')!.title).toBe(
      'Plain'
    )
    expect(result.report).toContain('## Not imported')
    expect(result.report).toContain('"Plain"')
  })

  it('gives the same slug a second path, with the id', async () => {
    const xml = wxrOf([
      {
        id: 5,
        type: 'page',
        title: 'X',
        slug: 'x',
        meta: { _elementor_data: SIMPLE },
      },
      {
        id: 6,
        type: 'page',
        title: 'X again',
        slug: 'x',
        meta: { _elementor_data: SIMPLE },
      },
    ])

    await writeFile(input, xml)

    const result = await runImport({ input, out: out(), media: false })

    expect(result.pages.map((page) => page.path)).toEqual(['x', 'x-6'])
  })

  it('writes the theme and the report', async () => {
    await runImport({ input, out: out(), media: false, now: () => NOW })

    const theme = JSON.parse(
      await readFile(join(out(), 'pluto-import/theme.json'), 'utf8')
    )
    const report = await readFile(join(out(), 'pluto-import-report.md'), 'utf8')

    expect(theme).toEqual({
      colors: {
        primary: '#EF5777',
        secondary: '#51C9C0',
        text: '#222F3E',
        accent: '#1E90FF',
        background: '#ffffff',
      },
      fonts: {
        heading: '"Playfair Display", serif',
        body: '"Work Sans", sans-serif',
      },
    })
    expect(report).toContain('# Pluto import report')
    expect(report).toContain('### home')
    expect(report).toContain('shortcode [contact-form-7 id="12"]')
    expect(report).toContain('eael_')
    expect(report).toContain("name: 'Playfair Display', provider: 'google'")
    expect(report).toContain('Date: 2026-11-16T10:00:00.000Z')
  })
})

describe('--dry-run', () => {
  it('writes nothing, downloads nothing, and gives the plan and the report', async () => {
    const calls: string[] = []
    const result = await runImport({
      input,
      out: out(),
      dryRun: true,
      fetch: pngFetch(calls),
    })

    expect(await files(out())).toEqual([])
    expect(calls).toEqual([])
    expect(result.pages.map((page) => page.action)).toEqual([
      'planned',
      'planned',
      'planned',
    ])
    expect(result.written).toEqual([])
    expect(result.media.planned).toBeGreaterThan(0)
    expect(result.report).toContain('Mode: dry run')
    expect(result.themeSnippet).toContain('plutoBlocksTheme')
  })
})

describe('a re-run', () => {
  it('skips a page whose file has the same WordPress id', async () => {
    await runImport({ input, out: out(), media: false })

    const home = join(out(), 'content/pages/home.md')
    const before = await readFile(home, 'utf8')

    await writeFile(home, `${before}\nEdited by hand.\n`)

    const result = await runImport({ input, out: out(), media: false })

    expect(result.pages.map((page) => page.action)).toEqual([
      'skipped',
      'skipped',
      'skipped',
    ])
    expect(await readFile(home, 'utf8')).toContain('Edited by hand.')
  })

  it('writes the pages again with --force', async () => {
    await runImport({ input, out: out(), media: false })

    const home = join(out(), 'content/pages/home.md')

    await writeFile(home, 'Edited by hand.')

    const result = await runImport({
      input,
      out: out(),
      media: false,
      force: true,
    })

    expect(result.pages.map((page) => page.action)).toEqual([
      'written',
      'written',
      'written',
    ])
    expect(await readFile(home, 'utf8')).toContain('title: Welcome')
  })

  it('does not overwrite a file that is not from this page, unless forced', async () => {
    const home = join(out(), 'content/pages/home.md')

    await mkdir(dirname(home), { recursive: true })
    await writeFile(home, '---\ntitle: Mine\n---\nMy page.\n')

    const result = await runImport({ input, out: out(), media: false })

    expect(result.pages[0]!.action).toBe('conflict')
    expect(await readFile(home, 'utf8')).toContain('My page.')

    const forced = await runImport({
      input,
      out: out(),
      media: false,
      force: true,
    })

    expect(forced.pages[0]!.action).toBe('written')
  })

  it('does not download the images of a page it skips', async () => {
    await runImport({ input, out: out(), now: () => NOW, fetch: pngFetch() })

    const calls: string[] = []

    await runImport({ input, out: out(), fetch: pngFetch(calls) })

    expect(calls).toEqual([])
  })
})

describe('the media of the pages', () => {
  it('downloads the images and writes their new URLs in the page', async () => {
    const calls: string[] = []
    const result = await runImport({
      input,
      out: out(),
      now: () => NOW,
      fetch: pngFetch(calls),
    })
    const home = await readFile(join(out(), 'content/pages/home.md'), 'utf8')

    expect(result.media.downloaded).toBe(calls.length)
    expect(result.media.failures).toEqual([])
    expect(home).not.toContain('old.example.test/wp-content')
    expect(home).toMatch(/image="\/media\/2026\/11\/hero-bg-[0-9a-f]{5}\.png"/)
    expect(home).toMatch(
      /src="\/media\/2026\/11\/team-[0-9a-f]{5}\.png" alt="The team"/
    )
    expect((await files(join(out(), 'public/media'))).length).toBe(calls.length)
    expect((await files(join(out(), 'content/media'))).length).toBe(
      calls.length
    )
  })

  it('keeps the remote URLs of the images that fail', async () => {
    const result = await runImport({
      input,
      out: out(),
      fetch: (() =>
        Promise.resolve(new Response('', { status: 404 }))) as typeof fetch,
    })
    const home = await readFile(join(out(), 'content/pages/home.md'), 'utf8')

    expect(result.media.failures.length).toBeGreaterThan(0)
    expect(home).toContain(
      'https://old.example.test/wp-content/uploads/2024/01/hero-bg.jpg'
    )
    expect(result.report).toContain('## Images that were not downloaded')
  })

  it('keeps every remote URL and downloads nothing with no media', async () => {
    const calls: string[] = []

    await runImport({ input, out: out(), media: false, fetch: pngFetch(calls) })

    const home = await readFile(join(out(), 'content/pages/home.md'), 'utf8')

    expect(calls).toEqual([])
    expect(home).toContain(
      'https://old.example.test/wp-content/uploads/2024/01/hero-bg.jpg'
    )
    expect(await files(join(out(), 'public'))).toEqual([])
  })
})

describe('an Elementor page JSON', () => {
  it('imports one page as a draft, with the id of the file name', async () => {
    const json = join(root, 'elementor-649-2024-01-25.json')

    await writeFile(
      json,
      JSON.stringify({
        title: 'Landing Page',
        type: 'page',
        content: HOME_ELEMENTS,
        page_settings: [],
        version: '0.4',
      })
    )

    const result = await runImport({ input: json, out: out(), media: false })
    const page = parseMarkdownFile(
      await readFile(join(out(), 'content/pages/landing-page.md'), 'utf8')
    )

    expect(result.pages).toHaveLength(1)
    expect(page.frontmatter).toMatchObject({
      title: 'Landing Page',
      status: 'draft',
      wordpress: { id: 649 },
    })
    expect(result.theme).toBeUndefined()
  })

  it('reports a template that is not a page', async () => {
    const json = join(root, 'section.json')

    await writeFile(
      json,
      JSON.stringify({ title: 'Hero', type: 'section', content: [] })
    )

    const result = await runImport({ input: json, out: out(), media: false })

    expect(result.pages).toEqual([])
    expect(result.others[0]!.kind).toBe('Elementor section')
  })
})
