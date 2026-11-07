import type { PlutoContentType } from '../../../../shared/types/content'

/**
 * The Git CMS `author` type: the public profile of a post author (name, bio, avatar). The file is
 * `content/authors/<slug>.md`, frontmatter only; the slug (the file name) is the id that a post
 * stores in its `authors` list. An author has no status: it is public once saved. It has no link
 * to a sign-in user, so no user data goes to the public site. Writing and deleting need
 * `authors:manage`. See the authors skill.
 */
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
  // The author page of the site. Change this with `extendContentTypes` when the site uses another
  // path.
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
