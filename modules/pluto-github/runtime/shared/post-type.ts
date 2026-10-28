import type { PlutoContentType } from '../../../../shared/types/content'

/**
 * The built-in `post` content type of the standalone CMS. The storage keys
 * match the file layout: `content/posts/<slug>.md`. The slug is the file
 * name, so it is not a frontmatter key. The `content` field is the Markdown
 * body. The capability keys match the post type of `@plutocms/supabase-blog`.
 */
export const plutoGithubPostType: PlutoContentType = {
  name: 'post',
  label: 'Post',
  labelPlural: 'Posts',
  icon: 'lucide:file-text',
  source: 'posts',
  titleField: 'title',
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Title',
      required: true,
      inList: true,
      region: 'main',
    },
    {
      name: 'slug',
      type: 'slug',
      label: 'Slug',
      from: 'title',
      preview: '/post/',
      inList: true,
      region: 'side',
    },
    { name: 'excerpt', type: 'textarea', label: 'Excerpt', region: 'side' },
    { name: 'content', type: 'richtext', label: 'Content', region: 'main' },
  ],
  slug: { field: 'slug' },
  status: {
    column: 'status',
    default: 'draft',
    publishedValue: 'published',
    publishedAtColumn: 'publishedAt',
    values: [
      { label: 'Draft', value: 'draft' },
      { label: 'Published', value: 'published' },
    ],
  },
  timestamps: { created: 'createdAt', updated: 'updatedAt' },
  capabilities: {
    read: 'posts:read_drafts',
    write: 'posts:publish',
    delete: 'posts:delete',
  },
  defaultSort: { field: 'createdAt', direction: 'desc' },
  // "New Post" in the admin bar, and "Edit Post" on a page that calls `usePlutoEditLink('post', slug)`.
  adminBar: true,
  // Served by the public API: /api/pluto/v1/content/post.
  api: { public: true },
  form: { layout: 'focus', aside: true, asideCollapsed: true, width: 'full' },
}
