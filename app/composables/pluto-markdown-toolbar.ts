import type { EditorToolbarItem } from '@nuxt/ui'

/**
 * The toolbar items of the Markdown editor (the Nuxt UI editor, Tiptap): undo
 * and redo, headings, lists, quote, code block, and the text marks. The items
 * use the built-in handlers of the editor. Labels and tooltips come from the
 * `pluto.cms.editor.*` keys.
 *
 * The result follows the admin language. Pass `{ link: true }` to add a `link`
 * slot at the end. The caller fills that slot with its own link button, for
 * example `PlutoCmsEditorLink`.
 */
export function usePlutoMarkdownToolbar(options: {
 link?: boolean
} = {}) {
  const { t } = usePlutoI18n()

  return computed<EditorToolbarItem[][]>(() => [
    [
      { kind: 'undo', icon: 'i-lucide-undo', tooltip: { text: t('pluto.cms.editor.undo') } },
      { kind: 'redo', icon: 'i-lucide-redo', tooltip: { text: t('pluto.cms.editor.redo') } },
    ],
    [
      {
        icon: 'i-lucide-heading',
        tooltip: { text: t('pluto.cms.editor.headings') },
        content: { align: 'start' },
        items: ([1, 2, 3, 4] as const).map((level) => ({
          kind: 'heading' as const,
          level,
          icon: `i-lucide-heading-${level}`,
          label: t(`pluto.cms.editor.heading${level}`),
        })),
      },
      {
        icon: 'i-lucide-list',
        tooltip: { text: t('pluto.cms.editor.lists') },
        content: { align: 'start' },
        items: [
          { kind: 'bulletList', icon: 'i-lucide-list', label: t('pluto.cms.editor.bulletList') },
          { kind: 'orderedList', icon: 'i-lucide-list-ordered', label: t('pluto.cms.editor.orderedList') },
        ],
      },
      { kind: 'blockquote', icon: 'i-lucide-text-quote', tooltip: { text: t('pluto.cms.editor.blockquote') } },
      { kind: 'codeBlock', icon: 'i-lucide-square-code', tooltip: { text: t('pluto.cms.editor.codeBlock') } },
    ],
    [
      { kind: 'mark', mark: 'bold', icon: 'i-lucide-bold', tooltip: { text: t('pluto.cms.editor.bold') } },
      { kind: 'mark', mark: 'italic', icon: 'i-lucide-italic', tooltip: { text: t('pluto.cms.editor.italic') } },
      { kind: 'mark', mark: 'strike', icon: 'i-lucide-strikethrough', tooltip: { text: t('pluto.cms.editor.strike') } },
      { kind: 'mark', mark: 'code', icon: 'i-lucide-code', tooltip: { text: t('pluto.cms.editor.code') } },
      ...(options.link ? [{ slot: 'link', icon: 'i-lucide-link' }] : []),
    ],
  ])
}
