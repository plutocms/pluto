import type { PlutoContentType } from '../../../../shared/types/content'

export const plutoGithubPageType: PlutoContentType = {
  name: 'page',
  label: 'Page',
  labelPlural: 'Pages',
  icon: 'lucide:file',
  source: 'pages',
  titleField: 'title',
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
        'The path of the page, for example about or about/team. A new path moves the file.',
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
      widget: 'blocks',
      editor: 'visual',
      order: 40,
      region: 'main',
    },
  ],
  slug: { field: 'slug' },
  previewUrl: (item) =>
    item.status === 'published' && item.id
      ? `/${String(item.id)}`
      : undefined,
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
    read: 'pages:read_drafts',
    write: 'pages:publish',
    delete: 'pages:delete',
  },
  defaultSort: { field: 'id', direction: 'asc' },
  adminBar: true,
  liveOnSave: true,
  api: { public: true },
  trash: true,
  files: { nested: true },
  form: {
    layout: 'canvas',
    canvasField: 'body',
    leftPanel: {
      label: 'pluto.blocks.editor.blocks',
      class: 'bg-pluto-panel',
    },
  },
}
