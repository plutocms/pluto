import type { EditorToolbarItem } from '@nuxt/ui'

/**
 * The toolbar items of the Markdown editor (the Nuxt UI editor, Tiptap): undo
 * and redo, headings, lists, quote, code block, and the text marks. The items
 * use the built-in handlers of the editor. Labels and tooltips come from the
 * `pluto.github.editor.*` keys.
 *
 * The result follows the admin language. Pass `{ link: true }` to add a `link`
 * slot at the end. The caller fills that slot with its own link button, for
 * example `PlutoGithubEditorLink`.
 */
export function usePlutoMarkdownToolbar(
  options: {
    link?: boolean
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
        items: ([1, 2, 3, 4] as const).map((level) => ({
          kind: 'heading' as const,
          level,
          icon: `i-lucide-heading-${level}`,
          label: t(`pluto.github.editor.heading${level}`),
        })),
      },
      {
        icon: 'i-lucide-list',
        tooltip: { text: t('pluto.github.editor.lists') },
        content: { align: 'start' },
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
    ],
  ])
}
