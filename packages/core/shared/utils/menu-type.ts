import type { PlutoContentType } from '../types/content'

/** The parts of the menu type that a backend sets: where the menus live, and its columns. */
export type PlutoMenuStorage = Pick<
  PlutoContentType,
  'source' | 'files' | 'timestamps' | 'capabilities' | 'defaultSort'
>

/**
 * The `menu` content type, the same for every backend: a title, a handle (`main`) and a body of
 * `menu-item` blocks. A menu has no status: it is always live. A backend calls this with its
 * storage parts.
 * @example
 * export const menuType = definePlutoMenuType({
 *   source: 'menus',
 *   timestamps: { created: 'created_at', updated: 'updated_at' },
 *   capabilities: { write: 'menus:write', delete: 'menus:write' },
 * })
 * @see https://pluto.vulmix.dev/docs/build/menus
 */
export function definePlutoMenuType(
  storage: PlutoMenuStorage
): PlutoContentType {
  return {
    name: 'menu',
    label: 'Menu',
    labelPlural: 'Menus',
    description:
      'The navigation of the site. A template shows a menu by its handle, for example main.',
    icon: 'lucide:menu',
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
          'The name that a template uses to find the menu, for example main.',
        from: 'title',
        required: true,
        inList: true,
        order: 20,
        region: 'side',
      },
      {
        name: 'body',
        type: 'richtext',
        label: 'Items',
        widget: 'blocks',
        editor: 'visual',
        blocks: ['menu-item'],
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
