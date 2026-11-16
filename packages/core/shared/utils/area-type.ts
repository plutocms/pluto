import type { PlutoContentType } from '../types/content'

/** The parts of the area type that a backend sets: where the areas live, and its columns. */
export type PlutoAreaStorage = Pick<
  PlutoContentType,
  'source' | 'files' | 'timestamps' | 'capabilities' | 'defaultSort'
>

/**
 * The `area` content type, the same for every backend: a title, a handle (`footer`) and a block
 * body. An area has no status: it is always live. A backend calls this with its storage parts.
 * @example
 * export const areaType = definePlutoAreaType({
 *   source: 'areas',
 *   timestamps: { created: 'created_at', updated: 'updated_at' },
 *   capabilities: { write: 'areas:write', delete: 'areas:write' },
 * })
 * @see https://pluto.vulmix.dev/docs/build/areas
 */
export function definePlutoAreaType(
  storage: PlutoAreaStorage
): PlutoContentType {
  return {
    name: 'area',
    label: 'Area',
    labelPlural: 'Areas',
    description:
      'A part of the site that many pages share, such as the footer. A template shows an area by its handle, for example footer.',
    icon: 'lucide:panel-bottom',
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
        label: 'Handle',
        description:
          'The name that a template uses to find the area, for example footer.',
        from: 'title',
        required: true,
        inList: true,
        order: 20,
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
    status: false,
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
    ...storage,
  }
}
