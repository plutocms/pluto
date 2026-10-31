import { describe, expect, it } from 'vitest'
import { stringify } from 'yaml'
import {
  createDocsType,
  DOCS_CAPABILITIES,
  readDocsFrontmatter,
  writeDocsFrontmatter,
} from '../shared/utils/docs-type'

// The adapter parses a file, runs `read`, applies the form values on the flat
// keys, then runs `write`. These tests do the same steps on plain objects.

function roundTrip(frontmatter: Record<string, unknown>) {
  return writeDocsFrontmatter(readDocsFrontmatter(structuredClone(frontmatter)))
}

describe('createDocsType', () => {
  const type = createDocsType({ name: 'doc', source: '' })
  const names = type.fields.map((field) => field.name)

  it('has the fields of a docs page', () => {
    expect(names).toEqual([
      'title',
      'slug',
      'description',
      'body',
      'navigationTitle',
      'navigationIcon',
      'navigationHidden',
      'seoTitle',
      'seoDescription',
    ])
  })

  it('is public on the public API of core', () => {
    expect(type.api).toEqual({ public: true })
  })

  it('makes title the required field of the Page tab', () => {
    const title = type.fields.find((field) => field.name === 'title')
    expect(title).toMatchObject({
      type: 'text',
      required: true,
      region: 'side',
    })
    expect(type.titleField).toBe('title')
  })

  it('keeps the whole path in the slug field, never in the frontmatter', () => {
    expect(type.slug).toEqual({ field: 'slug' })
    expect(type.fields.find((field) => field.name === 'slug')).toMatchObject({
      type: 'slug',
    })
    expect(names).not.toContain('path')
  })

  it('makes the body a visual MDC field', () => {
    expect(type.fields.find((field) => field.name === 'body')).toMatchObject({
      type: 'richtext',
      widget: 'mdc',
      editor: 'visual',
    })
  })

  it('has no virtual field, because a virtual field is not read back', () => {
    expect(type.fields.some((field) => field.virtual)).toBe(false)
  })

  it('has no status and no timestamps', () => {
    expect(type.status).toBe(false)
    expect(type.timestamps).toBe(false)
  })

  it('sorts by id, which is the tree order', () => {
    expect(type.defaultSort).toEqual({ field: 'id', direction: 'asc' })
  })

  it('uses the canvas layout with the body on the canvas and the block list on the left', () => {
    expect(type.form).toEqual({
      layout: 'canvas',
      canvasField: 'body',
      leftPanel: {
        label: 'docs.editor.blocks',
        class: 'bg-white dark:bg-[#0b0b0b]',
      },
    })
  })

  it('builds the View link from the page id and the route prefix', () => {
    expect(
      type.previewUrl?.({ id: '1.getting-started/2.installation' } as never)
    ).toBe('/getting-started/installation')
    expect(type.previewUrl?.({ id: 'index' } as never)).toBe('/')
    expect(type.previewUrl?.({} as never)).toBeUndefined()
    expect(
      createDocsType({
        name: 'doc',
        source: '',
        routePrefix: '/docs',
      }).previewUrl?.({ id: 'a/b' } as never)
    ).toBe('/docs/a/b')
  })

  it('is in the pages group of core by default', () => {
    expect(type.navGroup).toBe('pages')
  })

  it('takes a nav group from the options, and none with false', () => {
    expect(
      createDocsType({ name: 'doc', source: '', navGroup: 'shop:catalog' })
        .navGroup
    ).toBe('shop:catalog')
    const alone = createDocsType({ name: 'doc', source: '', navGroup: false })
    expect('navGroup' in alone).toBe(false)
  })

  it('has the book icon, or the icon of the options', () => {
    expect(type.icon).toBe('lucide:book-open')
    expect(
      createDocsType({
        name: 'layer',
        source: 'layers',
        icon: 'i-lucide-layers',
      }).icon
    ).toBe('i-lucide-layers')
  })

  it('declares the docs capabilities', () => {
    expect(type.capabilities).toEqual({
      write: 'docs:write',
      delete: 'docs:delete',
    })
    expect(DOCS_CAPABILITIES).toEqual({
      write: 'docs:write',
      delete: 'docs:delete',
    })
  })

  it('is a nested type with the options of the caller', () => {
    expect(type.source).toBe('')
    expect(type.files?.nested).toBe(true)
    expect(type.files?.exclude).toEqual([])
    const custom = createDocsType({
      name: 'guide',
      source: 'guides',
      label: 'Guide',
      labelPlural: 'Guides',
      exclude: ['drafts/'],
    })
    expect(custom).toMatchObject({
      name: 'guide',
      source: 'guides',
      label: 'Guide',
      labelPlural: 'Guides',
    })
    expect(custom.files?.exclude).toEqual(['drafts/'])
  })

  it('maps each flat field to its own column', () => {
    for (const name of [
      'navigationTitle',
      'navigationIcon',
      'navigationHidden',
      'seoTitle',
      'seoDescription',
    ]) {
      const field = type.fields.find((entry) => entry.name === name)
      expect(field?.column ?? field?.name).toBe(name)
    }
  })

  it('has hooks that are pure functions', () => {
    expect(type.files?.frontmatter?.read).toBe(readDocsFrontmatter)
    expect(type.files?.frontmatter?.write).toBe(writeDocsFrontmatter)
  })
})

describe('readDocsFrontmatter', () => {
  it('adds the flat keys from navigation and seo', () => {
    expect(
      readDocsFrontmatter({
        title: 'A',
        navigation: { title: 'Nav', icon: 'i-lucide-box' },
        seo: { title: 'Seo', description: 'Seo text' },
      })
    ).toMatchObject({
      navigationTitle: 'Nav',
      navigationIcon: 'i-lucide-box',
      seoTitle: 'Seo',
      seoDescription: 'Seo text',
    })
  })

  it('reads navigation: false as hidden', () => {
    expect(readDocsFrontmatter({ navigation: false })).toMatchObject({
      navigationHidden: true,
    })
  })

  it('does not change its input', () => {
    const input = { navigation: { title: 'Nav' } }
    readDocsFrontmatter(input)
    expect(input).toEqual({ navigation: { title: 'Nav' } })
  })
})

describe('writeDocsFrontmatter', () => {
  it('gives the same frontmatter after read then write', () => {
    const samples: Array<Record<string, unknown>> = [
      { title: 'A', description: 'B' },
      { title: 'A', navigation: { icon: 'i-lucide-box' } },
      {
        title: 'A',
        navigation: { title: 'N', icon: 'i-lucide-box' },
        seo: { title: 'S', description: 'D' },
      },
      { title: 'A', navigation: false },
      { title: 'A', seo: { description: 'D' }, navigation: { title: 'N' } },
    ]
    for (const sample of samples) {
      const result = roundTrip(sample)
      expect(result).toEqual(sample)
      expect(stringify(result)).toBe(stringify(sample))
    }
  })

  it('keeps the key order', () => {
    const sample = {
      title: 'A',
      navigation: { icon: 'i-lucide-box', title: 'N' },
      links: [{ label: 'x', to: '/x' }],
    }
    const result = roundTrip(sample)
    expect(Object.keys(result)).toEqual(['title', 'navigation', 'links'])
    expect(Object.keys(result.navigation as object)).toEqual(['icon', 'title'])
  })

  it('folds flat values into navigation and seo', () => {
    expect(
      writeDocsFrontmatter({
        title: 'A',
        navigationTitle: 'Nav',
        navigationIcon: 'i-lucide-box',
        seoTitle: 'Seo',
        seoDescription: 'Seo text',
      })
    ).toEqual({
      title: 'A',
      navigation: { title: 'Nav', icon: 'i-lucide-box' },
      seo: { title: 'Seo', description: 'Seo text' },
    })
  })

  it('writes navigation: false for a hidden page', () => {
    expect(
      writeDocsFrontmatter({
        title: 'A',
        navigationHidden: true,
        navigationTitle: 'Nav',
      })
    ).toEqual({
      title: 'A',
      navigation: false,
    })
  })

  it('treats navigationHidden: false as not hidden', () => {
    expect(
      writeDocsFrontmatter({ title: 'A', navigationHidden: false })
    ).toEqual({ title: 'A' })
  })

  it('removes navigation: false when the page is not hidden any more', () => {
    expect(
      writeDocsFrontmatter({
        title: 'A',
        navigation: false,
        navigationTitle: 'Nav',
      })
    ).toEqual({
      title: 'A',
      navigation: { title: 'Nav' },
    })
    expect(writeDocsFrontmatter({ title: 'A', navigation: false })).toEqual({
      title: 'A',
    })
  })

  it('drops empty objects', () => {
    expect(
      writeDocsFrontmatter({ title: 'A', navigationTitle: '', seoTitle: '' })
    ).toEqual({ title: 'A' })
    expect(
      writeDocsFrontmatter({
        title: 'A',
        navigation: { title: 'N' },
        seo: { title: 'S' },
      })
    ).toEqual({ title: 'A' })
  })

  it('removes a key when the author clears the field', () => {
    // The flat title key is gone because the form value was empty.
    expect(
      writeDocsFrontmatter({
        navigation: { title: 'N', icon: 'i-lucide-box' },
        navigationIcon: 'i-lucide-box',
      })
    ).toEqual({
      navigation: { icon: 'i-lucide-box' },
    })
  })

  it('keeps the unknown keys of navigation and seo', () => {
    const sample = {
      navigation: { title: 'N', badge: 'new' },
      seo: { title: 'S', ogImage: '/a.png' },
    }
    expect(roundTrip(sample)).toEqual(sample)
    expect(
      writeDocsFrontmatter({
        ...readDocsFrontmatter(sample),
        navigationTitle: 'M',
        seoTitle: undefined,
      })
    ).toEqual({
      navigation: { title: 'M', badge: 'new' },
      seo: { ogImage: '/a.png' },
    })
  })

  it('keeps the unknown top-level keys', () => {
    const sample = {
      title: 'A',
      links: [{ label: 'x', icon: 'i', to: '/x' }],
      custom: { deep: [1, 2] },
      order: 3,
    }
    expect(roundTrip(sample)).toEqual(sample)
  })

  it('keeps a value of another type in navigation and seo', () => {
    const sample = { navigation: { title: 5 }, seo: { description: ['a'] } }
    expect(roundTrip(sample)).toEqual(sample)
  })

  it('does not change its input', () => {
    const input = { navigation: { title: 'N' }, navigationTitle: 'M' }
    writeDocsFrontmatter(input)
    expect(input).toEqual({ navigation: { title: 'N' }, navigationTitle: 'M' })
  })
})
