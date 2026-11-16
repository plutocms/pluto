import type { PlutoContentStatus, PlutoContentType } from '../types/content'

/** The parts of the page type that a backend sets: where the pages live, and its columns. */
export type PlutoPageStorage = Pick<
  PlutoContentType,
  'source' | 'files' | 'timestamps' | 'capabilities' | 'defaultSort'
> & {
  /** The column that holds the publish date. */
  publishedAtColumn: string
  /** More status options, such as `schedule` and `review`. */
  status?: Partial<Omit<PlutoContentStatus, 'values'>>
}

/**
 * The `page` content type, the same for every backend: a title, a path, a description and a
 * block body. The path is the whole path of the page, for example `about/team`. A backend calls
 * this with its storage parts.
 * @example
 * export const pageType = definePlutoPageType({
 *   source: 'pages',
 *   publishedAtColumn: 'published_at',
 *   timestamps: { created: 'created_at', updated: 'updated_at' },
 * })
 */
export function definePlutoPageType(
  storage: PlutoPageStorage
): PlutoContentType {
  const { publishedAtColumn, status, ...rest } = storage
  return {
    name: 'page',
    label: 'Page',
    labelPlural: 'Pages',
    icon: 'lucide:file',
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
          'The path of the page, for example about or about/team. A new path moves the page.',
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
        name: 'layout',
        type: 'select',
        label: 'Layout',
        description:
          'Default shows the title and a narrow text. Full width shows no title and uses the whole width.',
        options: [
          { label: 'Default', value: 'default' },
          { label: 'Full width', value: 'full' },
        ],
        default: 'default',
        order: 35,
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
    previewUrl: (item) => {
      const path =
        typeof item.slug === 'string' && item.slug ? item.slug : item.id
      return item.status === 'published' && path
        ? `/${String(path)}`
        : undefined
    },
    status: {
      column: 'status',
      default: 'draft',
      publishedValue: 'published',
      publishedAtColumn,
      values: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
      ...status,
    },
    defaultSort: { field: 'slug', direction: 'asc' },
    adminBar: true,
    liveOnSave: true,
    api: { public: true },
    trash: true,
    form: {
      layout: 'canvas',
      canvasField: 'body',
      leftPanel: {
        label: 'pluto.blocks.editor.blocks',
        class: 'bg-pluto-panel',
      },
    },
    ...rest,
  }
}
