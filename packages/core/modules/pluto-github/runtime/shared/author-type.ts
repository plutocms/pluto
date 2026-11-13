import type { PlutoContentType } from '../../../../shared/types/content'

export const plutoGithubAuthorType: PlutoContentType = {
  name: 'author',
  label: 'Author',
  labelPlural: 'Authors',
  icon: 'lucide:user-pen',
  source: 'authors',
  titleField: 'name',
  fields: [
    {
      name: 'name',
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
      from: 'name',
      preview: '/authors/',
      inList: true,
      region: 'main',
    },
    {
      name: 'bio',
      type: 'textarea',
      label: 'Bio',
      rows: 3,
      region: 'main',
    },
    {
      name: 'avatar',
      type: 'media',
      label: 'Avatar',
      accept: ['image/*'],
      region: 'main',
    },
  ],
  slug: { field: 'slug' },
  previewUrl: (item) =>
    typeof item.slug === 'string' && item.slug
      ? `/authors/${item.slug}`
      : undefined,
  timestamps: { created: 'createdAt', updated: 'updatedAt' },
  capabilities: {
    write: 'authors:manage',
    delete: 'authors:manage',
  },
  defaultSort: { field: 'name', direction: 'asc' },
  liveOnSave: true,
  api: { public: true },
  trash: true,
}
