import type { PlutoContentType } from '../../../../shared/types/content'

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
    trash: true,
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

export const plutoGithubTermTypes: PlutoContentType[] = [
  plutoGithubTagType,
  plutoGithubCategoryType,
]
