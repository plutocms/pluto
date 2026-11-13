import type { PlutoSeoConfig } from '../types/seo'

type Frontmatter = Record<string, unknown>

/** The "SEO" group of the side column. It is closed when the form loads. */
export const PLUTO_SEO_GROUP: PlutoContentSideGroup = {
  id: 'seo',
  label: 'seo.group',
  icon: 'lucide:search',
  order: 900,
  defaultOpen: false,
}

/**
 * The SEO fields, in form order. The columns match the Supabase blog migration
 * `006_post_seo.sql`: do not rename them.
 */
export const PLUTO_SEO_FIELDS: PlutoField[] = [
  {
    name: 'seoPreview',
    type: 'text',
    label: 'Search and social preview',
    virtual: true,
    widget: 'seo-preview',
    inList: false,
    order: 900,
    region: 'side',
    group: 'seo',
  },
  {
    name: 'seoTitle',
    type: 'text',
    label: 'SEO title',
    description:
      'The title in search results and on social cards. Empty: the title.',
    column: 'seo_title',
    inList: false,
    order: 901,
    region: 'side',
    group: 'seo',
  },
  {
    name: 'seoDescription',
    type: 'textarea',
    label: 'SEO description',
    description:
      'One or two sentences for the search result. Empty: the excerpt.',
    column: 'seo_description',
    rows: 3,
    inList: false,
    order: 902,
    region: 'side',
    group: 'seo',
  },
  {
    name: 'seoImage',
    type: 'media',
    label: 'Social image',
    description: 'The image on social cards. Empty: the cover image.',
    column: 'seo_image',
    accept: ['image/*'],
    inList: false,
    order: 903,
    region: 'side',
    group: 'seo',
  },
  {
    name: 'seoNoindex',
    type: 'boolean',
    label: 'Hide from search engines',
    description:
      'Adds noindex, and leaves the page out of the sitemap and the feed.',
    column: 'seo_noindex',
    inList: false,
    order: 904,
    region: 'side',
    group: 'seo',
  },
]

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

/**
 * Runs after a file is parsed. Adds the flat keys that the form fields read (`seo_title`,
 * `seo_description`, `seo_image`, `seo_noindex`) from the `seo` object. It keeps every other key,
 * the `seo` object too: the write hook needs it to keep the keys it does not know.
 */
export function plutoSeoReadFrontmatter(frontmatter: Frontmatter): Frontmatter {
  const out: Frontmatter = { ...frontmatter }
  const seo = frontmatter.seo
  if (isRecord(seo)) {
    if (hasText(seo.title)) {
      out.seo_title = seo.title
    }
    if (hasText(seo.description)) {
      out.seo_description = seo.description
    }
    if (hasText(seo.image)) {
      out.seo_image = seo.image
    }
    if (seo.noindex === true) {
      out.seo_noindex = true
    }
  }
  return out
}

/**
 * Runs before a file is written. Folds the flat keys back into the `seo` object, and drops them.
 * The flat keys win: a missing flat key means the author cleared the field. Keys of `seo` that
 * the layer does not know stay. An empty value removes its key, an empty `seo` goes away, and
 * `noindex: false` is not written.
 */
export function plutoSeoWriteFrontmatter(
  frontmatter: Frontmatter
): Frontmatter {
  const out: Frontmatter = { ...frontmatter }
  const {
    seo_title: title,
    seo_description: description,
    seo_image: image,
    seo_noindex: noindex,
  } = frontmatter
  delete out.seo_title
  delete out.seo_description
  delete out.seo_image
  delete out.seo_noindex

  const seo = frontmatter.seo
  const object: Frontmatter = isRecord(seo) ? { ...seo } : {}
  applyText(object, 'title', title)
  applyText(object, 'description', description)
  applyText(object, 'image', image)
  if (noindex === true) {
    object.noindex = true
  } else if (
    object.noindex === undefined ||
    typeof object.noindex === 'boolean'
  ) {
    delete object.noindex
  }

  if (Object.keys(object).length > 0) {
    out.seo = object
  } else if (isRecord(seo)) {
    delete out.seo
  }
  return out
}

/**
 * Adds the SEO fields to a content type, and returns a new type. A field name that the type
 * already has stays as the owner declared it (a dev warning names it). The "SEO" side group joins
 * the groups of the type, unless the type has a group `seo` already. When the type lists its
 * public fields (`api.fields`), the new stored fields join the list. The `files.frontmatter`
 * hooks of the type stay: the layer reads after the owner and writes before it.
 */
export function plutoSeoWithFields(type: PlutoContentType): PlutoContentType {
  const names = new Set(type.fields.map((field) => field.name))
  const added = PLUTO_SEO_FIELDS.filter((field) => !names.has(field.name))
  if (import.meta.dev) {
    for (const field of PLUTO_SEO_FIELDS) {
      if (names.has(field.name)) {
        console.warn(
          `[pluto] seo: content type "${type.name}" has a field "${field.name}" already. The layer keeps it.`
        )
      }
    }
  }
  if (added.length === 0) {
    return type
  }

  const owner = type.files?.frontmatter
  const groups = type.sideGroups ?? []
  return {
    ...type,
    fields: [...type.fields, ...added],
    sideGroups: groups.some((group) => group.id === PLUTO_SEO_GROUP.id)
      ? groups
      : [...groups, PLUTO_SEO_GROUP],
    ...(type.api?.fields && {
      api: {
        ...type.api,
        fields: [
          ...type.api.fields,
          ...added.filter((field) => !field.virtual).map((field) => field.name),
        ],
      },
    }),
    files: {
      ...type.files,
      frontmatter: {
        read: (frontmatter) =>
          plutoSeoReadFrontmatter(
            owner?.read ? owner.read(frontmatter) : frontmatter
          ),
        write: (frontmatter) => {
          const folded = plutoSeoWriteFrontmatter(frontmatter)
          return owner?.write ? owner.write(folded) : folded
        },
      },
    },
  }
}

/**
 * The content type extension of the layer: it adds the SEO fields to the types that
 * `config.types` turns on. The server plugin and the client plugin both register it.
 */
export function plutoSeoTypeExtension(
  config: Pick<PlutoSeoConfig, 'types'>
): PlutoContentTypeExtension {
  return {
    id: 'seo',
    extend: (type) =>
      config.types[type.name] === true ? plutoSeoWithFields(type) : type,
  }
}
