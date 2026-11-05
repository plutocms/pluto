import type { PlutoContentType } from '../../../../shared/types/content'

/**
 * The Git CMS term types: `tag` and `category`. A term is a content type, so the admin, the
 * public API and the static index need no special case. The file is `content/<source>/<slug>.md`;
 * the slug (the file name) is the id that a post stores. A term has no status and no body.
 * Writing and deleting need `terms:manage`. See the tags-and-categories skill.
 */
function termType(options: {
  name: 'tag' | 'category'
  label: string
  labelPlural: string
  icon: string
  source: string
  path: string
}): PlutoContentType {
  return {
    name: options.name,
    label: options.label,
    labelPlural: options.labelPlural,
    icon: options.icon,
    source: options.source,
    titleField: 'title',
    fields: [
      {
        name: 'title',
        type: 'text',
        label: 'Name',
        required: true,
        inList: true,
        region: 'main',
      },
      {
        name: 'slug',
        type: 'slug',
        label: 'Slug',
        from: 'title',
        preview: options.path,
        inList: true,
        region: 'main',
      },
      {
        name: 'description',
        type: 'textarea',
        label: 'Description',
        region: 'main',
      },
    ],
    slug: { field: 'slug' },
    // The term page of the site. The core blog template has no term page: change this with
    // `extendContentTypes` when the site uses another path.
    previewUrl: (item) =>
      typeof item.slug === 'string' && item.slug
        ? `${options.path}${item.slug}`
        : undefined,
    timestamps: { created: 'createdAt', updated: 'updatedAt' },
    capabilities: {
      write: 'terms:manage',
      delete: 'terms:manage',
    },
    defaultSort: { field: 'title', direction: 'asc' },
    liveOnSave: true,
    api: { public: true },
  }
}

export const plutoGithubTagType: PlutoContentType = termType({
  name: 'tag',
  label: 'Tag',
  labelPlural: 'Tags',
  icon: 'lucide:tag',
  source: 'tags',
  path: '/tags/',
})

export const plutoGithubCategoryType: PlutoContentType = termType({
  name: 'category',
  label: 'Category',
  labelPlural: 'Categories',
  icon: 'lucide:folder',
  source: 'categories',
  path: '/categories/',
})

/** The term types that register with `post`. */
export const plutoGithubTermTypes: PlutoContentType[] = [
  plutoGithubTagType,
  plutoGithubCategoryType,
]
