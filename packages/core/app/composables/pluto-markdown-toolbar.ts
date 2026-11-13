import type { EditorSuggestionMenuItem, EditorToolbarItem } from '@nuxt/ui'

/**
 * The toolbar items of the Markdown editor (the Nuxt UI editor, Tiptap): undo
 * and redo, headings, lists, quote, code block, and the text marks. The items
 * use the built-in handlers of the editor. Labels and tooltips come from the
 * `pluto.github.editor.*` keys.
 *
 * The result follows the admin language. Pass `{ link: true }` to add a `link`
 * slot at the end. The caller fills that slot with its own link button, for
 * example `PlutoGithubEditorLink`. `{ component: true }` adds a `component` slot for
 * `PlutoBlockInsertMenu` (the content components of the site).
 */
export function usePlutoMarkdownToolbar(
  options: {
    link?: boolean
    image?: boolean
    component?: boolean
  } = {}
) {
  const { t } = usePlutoI18n()

  return computed<EditorToolbarItem[][]>(() => [
    [
      {
        kind: 'undo',
        icon: 'i-lucide-undo',
        tooltip: { text: t('pluto.github.editor.undo') },
      },
      {
        kind: 'redo',
        icon: 'i-lucide-redo',
        tooltip: { text: t('pluto.github.editor.redo') },
      },
    ],
    [
      {
        icon: 'i-lucide-heading',
        tooltip: { text: t('pluto.github.editor.headings') },
        content: { align: 'start' },
        arrow: true,
        items: [
          {
            kind: 'paragraph' as const,
            icon: 'i-lucide-type',
            label: t('pluto.github.editor.paragraph'),
          },
          ...([1, 2, 3, 4] as const).map((level) => ({
            kind: 'heading' as const,
            level,
            icon: `i-lucide-heading-${level}`,
            label: t(`pluto.github.editor.heading${level}`),
          })),
        ],
      },
      {
        icon: 'i-lucide-list',
        tooltip: { text: t('pluto.github.editor.lists') },
        content: { align: 'start' },
        arrow: true,
        items: [
          {
            kind: 'bulletList',
            icon: 'i-lucide-list',
            label: t('pluto.github.editor.bulletList'),
          },
          {
            kind: 'orderedList',
            icon: 'i-lucide-list-ordered',
            label: t('pluto.github.editor.orderedList'),
          },
        ],
      },
      {
        kind: 'blockquote',
        icon: 'i-lucide-text-quote',
        tooltip: { text: t('pluto.github.editor.blockquote') },
      },
      {
        kind: 'codeBlock',
        icon: 'i-lucide-square-code',
        tooltip: { text: t('pluto.github.editor.codeBlock') },
      },
    ],
    [
      {
        kind: 'mark',
        mark: 'bold',
        icon: 'i-lucide-bold',
        tooltip: { text: t('pluto.github.editor.bold') },
      },
      {
        kind: 'mark',
        mark: 'italic',
        icon: 'i-lucide-italic',
        tooltip: { text: t('pluto.github.editor.italic') },
      },
      {
        kind: 'mark',
        mark: 'strike',
        icon: 'i-lucide-strikethrough',
        tooltip: { text: t('pluto.github.editor.strike') },
      },
      {
        kind: 'mark',
        mark: 'code',
        icon: 'i-lucide-code',
        tooltip: { text: t('pluto.github.editor.code') },
      },
      ...(options.link ? [{ slot: 'link', icon: 'i-lucide-link' }] : []),
      ...(options.image ? [{ slot: 'image', icon: 'i-lucide-image' }] : []),
      ...(options.component
        ? [{ slot: 'component', icon: 'i-lucide-puzzle' }]
        : []),
    ],
  ])
}

/**
 * The bubble toolbar of the Markdown editor: it shows over a text selection. The text marks, and
 * the link button (a `slot: 'link'` item, filled by the caller).
 */
export function usePlutoMarkdownBubbleItems() {
  const { t } = usePlutoI18n()

  return computed<EditorToolbarItem[][]>(() => [
    [
      {
        kind: 'mark',
        mark: 'bold',
        icon: 'i-lucide-bold',
        tooltip: { text: t('pluto.github.editor.bold') },
      },
      {
        kind: 'mark',
        mark: 'italic',
        icon: 'i-lucide-italic',
        tooltip: { text: t('pluto.github.editor.italic') },
      },
      {
        kind: 'mark',
        mark: 'strike',
        icon: 'i-lucide-strikethrough',
        tooltip: { text: t('pluto.github.editor.strike') },
      },
      {
        kind: 'mark',
        mark: 'code',
        icon: 'i-lucide-code',
        tooltip: { text: t('pluto.github.editor.code') },
      },
      { slot: 'link', icon: 'i-lucide-link' },
    ],
  ])
}

/** A content component of the site in the slash menu. */
export interface PlutoMarkdownSuggestionComponent {
  name: string
  label: string
  icon?: string
}

/**
 * The block menu of the Markdown editor: the slash menu (`/` in an empty line) and the "+" of
 * the drag handle. The blocks that Markdown keeps, then the content components of the site (the
 * `plutoComponent` handler of `PlutoFieldMarkdown` inserts one and opens its settings).
 */
export function usePlutoMarkdownSuggestionItems(
  components: MaybeRefOrGetter<PlutoMarkdownSuggestionComponent[]> = []
) {
  const { t } = usePlutoI18n()

  return computed<EditorSuggestionMenuItem[][]>(() => {
    const list = toValue(components)
    return [
      [
        { type: 'label', label: t('pluto.github.editor.style') },
        {
          kind: 'paragraph',
          icon: 'i-lucide-type',
          label: t('pluto.github.editor.paragraph'),
        },
        ...([1, 2, 3, 4] as const).map((level) => ({
          kind: 'heading' as const,
          level,
          icon: `i-lucide-heading-${level}`,
          label: t(`pluto.github.editor.heading${level}`),
        })),
        {
          kind: 'bulletList',
          icon: 'i-lucide-list',
          label: t('pluto.github.editor.bulletList'),
        },
        {
          kind: 'orderedList',
          icon: 'i-lucide-list-ordered',
          label: t('pluto.github.editor.orderedList'),
        },
        {
          kind: 'blockquote',
          icon: 'i-lucide-text-quote',
          label: t('pluto.github.editor.blockquote'),
        },
        {
          kind: 'codeBlock',
          icon: 'i-lucide-square-code',
          label: t('pluto.github.editor.codeBlock'),
        },
      ],
      ...(list.length > 0
        ? [
            [
              {
                type: 'label' as const,
                label: t('pluto.github.editor.insert'),
              },
              ...list.map((component) => ({
                kind: 'plutoComponent',
                name: component.name,
                icon: component.icon ?? 'i-lucide-puzzle',
                label: component.label,
              })),
            ],
          ]
        : []),
    ] as EditorSuggestionMenuItem[][]
  })
}
