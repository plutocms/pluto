// The docs preset. Pure code with no Nuxt import, so plain Vitest tests it.
// It builds the content type of a Nuxt Content docs page. The frontmatter
// hooks map `navigation` and `seo` to flat keys, so each of them is a normal
// field (a virtual field is not read back). See the docs-preset skill.

import { contentRoutePath } from './content-route'

type Frontmatter = Record<string, unknown>

function isRecord(value: unknown): value is Frontmatter {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}

/**
 * Sets a key of a nested object from a flat value. An empty flat value removes
 * the key, but only when the key holds text or nothing: a value of another
 * type (a number, a list) stays as the author wrote it.
 */
function applyText(target: Frontmatter, key: string, flat: unknown): void {
  if (hasText(flat)) {
    target[key] = flat
  } else if (target[key] === undefined || typeof target[key] === 'string') {
    delete target[key]
  }
}

/**
 * Runs after a file is parsed. Adds the flat keys that the form fields read:
 * `navigationTitle`, `navigationIcon`, `navigationHidden` (from `navigation`)
 * and `seoTitle`, `seoDescription` (from `seo`). It keeps every other key.
 */
export function readDocsFrontmatter(frontmatter: Frontmatter): Frontmatter {
  const out: Frontmatter = { ...frontmatter }
  const navigation = frontmatter.navigation
  if (navigation === false) {
    out.navigationHidden = true
  } else if (isRecord(navigation)) {
    if (typeof navigation.title === 'string') {
      out.navigationTitle = navigation.title
    }
    if (typeof navigation.icon === 'string') {
      out.navigationIcon = navigation.icon
    }
  }
  const seo = frontmatter.seo
  if (isRecord(seo)) {
    if (typeof seo.title === 'string') {
      out.seoTitle = seo.title
    }
    if (typeof seo.description === 'string') {
      out.seoDescription = seo.description
    }
  }
  return out
}

/**
 * Runs before a file is written. Folds the flat keys back into `navigation`
 * and `seo`, and drops them. The flat keys win: a missing flat key means the
 * author cleared the field. Keys of `navigation` and `seo` that the preset does
 * not know stay. An empty object is dropped. A hidden page gets
 * `navigation: false`, which replaces the title and the icon.
 */
export function writeDocsFrontmatter(frontmatter: Frontmatter): Frontmatter {
  const out: Frontmatter = { ...frontmatter }
  const {
    navigationTitle,
    navigationIcon,
    navigationHidden,
    seoTitle,
    seoDescription,
  } = frontmatter
  delete out.navigationTitle
  delete out.navigationIcon
  delete out.navigationHidden
  delete out.seoTitle
  delete out.seoDescription

  // navigation
  const navigation = frontmatter.navigation
  if (navigationHidden === true) {
    out.navigation = false
  } else {
    const object: Frontmatter = isRecord(navigation) ? { ...navigation } : {}
    applyText(object, 'title', navigationTitle)
    applyText(object, 'icon', navigationIcon)
    if (Object.keys(object).length > 0) {
      out.navigation = object
    } else if (isRecord(navigation) || navigation === false) {
      delete out.navigation
    }
  }

  // seo
  const seo = frontmatter.seo
  const seoObject: Frontmatter = isRecord(seo) ? { ...seo } : {}
  applyText(seoObject, 'title', seoTitle)
  applyText(seoObject, 'description', seoDescription)
  if (Object.keys(seoObject).length > 0) {
    out.seo = seoObject
  } else if (isRecord(seo)) {
    delete out.seo
  }

  return out
}

export interface DocsTypeOptions {
  /** The content type name, for example `doc`. */
  name: string
  /** The folder under the CMS content dir. `''` is the content dir itself. */
  source: string
  label?: string
  labelPlural?: string
  /** The Iconify name of the type in the admin. Default `lucide:book-open`. */
  icon?: string
  /** Ids to hide from the list: an id (`index`), or a folder with a trailing slash. */
  exclude?: string[]
  /** The public path in front of the page paths, for example `/docs`. It builds the View link. */
  routePrefix?: string
  /**
   * The public site shows a save at once, because it reads the type at run time (the render mode
   * is `hybrid` or `runtime`). The build indicator of the edit form then shows "Live" after a save.
   */
  liveOnSave?: boolean
  /**
   * The nav group of the type in the admin sidebar and the admin bar. Default `'pages'`, the group
   * of core: the docs types show as the children of one "Pages" item, and in one "New" menu. A group
   * id puts the type in another group. `false` gives the type its own item.
   */
  navGroup?: string | false
}

/** The nav group of a docs type when the options set none. Core declares it. */
export const DEFAULT_DOCS_NAV_GROUP = 'pages'

/** The capabilities of the docs preset. The client plugin registers them. */
export const DOCS_CAPABILITIES = {
  write: 'docs:write',
  delete: 'docs:delete',
} as const

/**
 * The docs page type. The id of an item is the path of the file under `source`
 * without `.md` (`2.core/03.content-model`). The slug field holds that whole
 * path, and a new path moves the file. The path is never a frontmatter key,
 * because Nuxt Content reserves `path`.
 */
export function createDocsType(options: DocsTypeOptions): PlutoContentType {
  const navGroup =
    options.navGroup === false
      ? undefined
      : (options.navGroup ?? DEFAULT_DOCS_NAV_GROUP)
  return {
    name: options.name,
    label: options.label ?? 'Page',
    labelPlural: options.labelPlural ?? 'Pages',
    icon: options.icon ?? 'lucide:book-open',
    ...(navGroup && { navGroup }),
    source: options.source,
    titleField: 'title',
    slug: { field: 'slug' },
    fields: [
      {
        name: 'title',
        type: 'text',
        label: 'Title',
        required: true,
        inList: true,
        order: 10,
        region: 'side',
      },
      {
        name: 'slug',
        type: 'slug',
        label: 'Path',
        description:
          'The file path without .md, for example 2.core/03.content-model. A new path moves the file.',
        required: true,
        inList: true,
        order: 20,
        region: 'side',
      },
      {
        name: 'description',
        type: 'textarea',
        label: 'Description',
        rows: 2,
        order: 30,
        region: 'side',
      },
      {
        name: 'body',
        type: 'richtext',
        label: 'Content',
        widget: 'mdc',
        editor: 'visual',
        inList: false,
        order: 40,
        region: 'main',
      },
      {
        name: 'navigationTitle',
        type: 'text',
        label: 'Navigation title',
        order: 110,
        inList: false,
        region: 'side',
      },
      {
        name: 'navigationIcon',
        type: 'text',
        label: 'Navigation icon',
        placeholder: 'i-lucide-rocket',
        order: 120,
        inList: false,
        region: 'side',
      },
      {
        name: 'navigationHidden',
        type: 'boolean',
        label: 'Hide from the navigation',
        order: 130,
        inList: false,
        region: 'side',
      },
      {
        name: 'seoTitle',
        type: 'text',
        label: 'SEO title',
        order: 140,
        inList: false,
        region: 'side',
      },
      {
        name: 'seoDescription',
        type: 'textarea',
        label: 'SEO description',
        rows: 3,
        order: 150,
        inList: false,
        region: 'side',
      },
    ],
    // "New page" and "Edit page" in the admin bar (core). See the page-links skill.
    adminBar: true,
    // The pages are public on core's public API: /api/pluto/v1/content/<name>[/<id>] (the item has
    // `html`, rendered by the CMS adapter).
    api: { public: true },
    ...(options.liveOnSave && { liveOnSave: true }),
    status: false,
    timestamps: false,
    // Tree order: the numeric prefixes decide, not the title.
    defaultSort: { field: 'id', direction: 'asc' },
    capabilities: {
      write: DOCS_CAPABILITIES.write,
      delete: DOCS_CAPABILITIES.delete,
    },
    // The canvas layout: the body fills the page (the block editor), and the other fields are in the Page tab.
    // `leftPanel`: the block list. Core shows its skeleton while the page or the editor code loads.
    form: {
      layout: 'canvas',
      canvasField: 'body',
      leftPanel: {
        label: 'docs.editor.blocks',
        class: 'bg-white dark:bg-[#0b0b0b]',
      },
    },
    previewUrl: (item) =>
      item.id
        ? contentRoutePath(String(item.id), options.routePrefix ?? '')
        : undefined,
    files: {
      nested: true,
      exclude: options.exclude ?? [],
      frontmatter: { read: readDocsFrontmatter, write: writeDocsFrontmatter },
    },
  }
}

/** Builds a content type from a preset entry of the module options. */
export function createPresetType(
  entry: DocsTypeOptions & { preset: 'docs' }
): PlutoContentType {
  return createDocsType(entry)
}
