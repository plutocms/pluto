import { contentRoutePath } from './content-route'

type Frontmatter = Record<string, unknown>

function isRecord(value: unknown): value is Frontmatter {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}

function applyText(target: Frontmatter, key: string, flat: unknown): void {
  if (hasText(flat)) {
    target[key] = flat
  } else if (target[key] === undefined || typeof target[key] === 'string') {
    delete target[key]
  }
}

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

const DEFAULT_DOCS_NAV_GROUP = 'pages'

export const DOCS_CAPABILITIES = {
  write: 'docs:write',
  delete: 'docs:delete',
} as const

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
    adminBar: true,
    api: { public: true },
    ...(options.liveOnSave && { liveOnSave: true }),
    status: false,
    timestamps: false,
    defaultSort: { field: 'id', direction: 'asc' },
    capabilities: {
      write: DOCS_CAPABILITIES.write,
      delete: DOCS_CAPABILITIES.delete,
    },
    form: {
      layout: 'canvas',
      canvasField: 'body',
      leftPanel: {
        label: 'docs.editor.blocks',
        class: 'bg-pluto-panel',
      },
    },
    previewUrl: (item) =>
      item.id
        ? contentRoutePath(String(item.id), options.routePrefix ?? '')
        : undefined,
    files: {
      nested: true,
      // A type over the whole content dir (`source: ''`) never lists the media records of the
      // Git CMS (`<dir>/media/<id>.md`): they are files of the media library, not pages.
      exclude: [
        ...(options.exclude ?? []),
        ...(options.source === '' && !(options.exclude ?? []).includes('media/')
          ? ['media/']
          : []),
      ],
      frontmatter: { read: readDocsFrontmatter, write: writeDocsFrontmatter },
    },
  }
}
