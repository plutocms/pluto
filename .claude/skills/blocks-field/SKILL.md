# Blocks field

The `blocks` field widget of core edits a Markdown body in two modes: **Visual** (the block editor,
see the [block editor](../block-editor/SKILL.md) skill) and **Markdown** (raw Markdown, with an
**Insert** menu of the palette blocks). The Markdown has components (`::note`, `:icon{name=""}`).
Any content type can use it:

```ts
{ name: 'body', type: 'richtext', widget: 'blocks', editor: 'visual' }
```

There is no `mdc` widget name.

## The public site

A type whose body is a `blocks` field has the same body on the public site (the block model skill,
"Public render"). In the item view, the public API gives `blocks` (a Comark document) and no `html`.
`<PlutoBlocks :value="item.blocks" />` renders it. The page type (`plutoPages.enabled`) is such a
type, and `usePage(path)` reads it. So are the menu and the area type (`plutoMenus`, `plutoAreas`): see the
content model skill, "Menus and areas".

## Limit the top level

The field option `blocks: ['menu-item']` limits the top level of the block editor to the named components.
`PlutoFieldBlocks` passes it to the editor (`accepts` prop, then the `accepts` option of
`createPlutoBlockEditor`, then `editor.accepts`). `PlutoBlockPalette` uses it when the target is the top
level, and `buildPalette(sources, accepts)` then lists only those blocks: no text, table or code entry, and
a `hidden` block of the list shows. A slot keeps the `accepts` of its own block. Without the option the
top level is open. The Markdown source mode and the Insert menu are not limited: the author can still type
any block there.

## The two modes

- The first mode is the `editor` option of the field: `visual` (or `auto`) or `source`. The docs type
  sets `visual`. The cookie `pluto-mdc-editor-mode` keeps the last choice of the author.
- Visual needs the `canvas` form layout, because its panels live in the form. In any other layout
  (or outside a form) the widget shows only Markdown, with no switch.
- The Visual and Markdown switch is at the bottom of the block list, and at the end of the
  Markdown toolbar.
- The block editor loads on demand. A skeleton shows while it loads.
- Markdown in a canvas form (`PlutoBlockMarkdownSplit`, loaded on demand): the Markdown at the left
  and the live preview at the right (stacked below `lg`). The preview is the frame of the visual
  editor. A block model of the text (`createPlutoBlockEditor`, which never writes) feeds it, and
  the frame renders again after each change. A click on a block in the preview selects the first
  line of that block in the editor (`block.original.start`, `reveal()`) and scrolls it to the upper
  third. A handle resizes the two panes (cookie `pluto-mdc-split`, 25 to 75 percent).

## The Markdown editor (`PlutoMarkdownCodeEditor` of core)

The Markdown editor is `PlutoMarkdownCodeEditor` of `@plutocms/core` (CodeMirror 6). The git-cms
skill ("Markdown code editor") describes it: the format shown as the author types, the MDC line
colors (`mdcLineKinds`), the quick formats (`formatMarkdown`) and their shortcuts, search and
history.

- The widget uses the global component names, so a local pluto checkout (`PLUTO_CORE_PATH`) is
  the one that loads: `<LazyPlutoMarkdownCodeEditor>` in `PlutoFieldBlocks` (on demand), and
  `<PlutoMarkdownCodeEditor>` in `PlutoBlockMarkdownSplit` (itself loaded on demand). The type of
  the template ref comes from `import type { PlutoMarkdownCodeEditor } from '#components'`.
- The `toolbar` slot (the Insert menu) gets `insert` and `focus`. Exposed: `insert`, `focus`,
  `reveal(start, end)` and `goToLine(line)`.

## Files

In `packages/core`:

- `app/components/Pluto/Content/fields/PlutoFieldBlocks.vue`: the widget.
- `app/plugins/pluto-core-registrations.ts`: registers it as `{ id: 'blocks', widget: 'blocks' }`
  with `defineAsyncComponent`.
- `app/components/Pluto/Block/PlutoBlockSnippetMenu.vue`: the Insert menu.
- `app/components/Pluto/Block/PlutoBlockMarkdownSplit.vue`: Markdown and preview side by side.

In the docs layer: `shared/utils/mdc-snippets.ts` (`MDC_SNIPPETS`, the snippets as pure data, used
as the `insert` text of the presets) and `test/mdc-snippets.test.ts` (checks that every block
snippet closes).

## How it works

- It follows the field widget contract: props `field`, `modelValue`, `disabled`, and the
  `update:modelValue` event. It uses `UFormField`, like the other core widgets.
- The Markdown mode uses `PlutoMarkdownCodeEditor` (above). It never parses or rewrites the text, so
  MDC stays as the author wrote it. (Core `PlutoMarkdownSource`, a textarea, is still the editor of
  `PlutoBlockRawEditor` in the Block panel.)
- It fills the `#toolbar="{ insert, focus }"` slot with `PlutoBlockSnippetMenu`. A menu item calls
  `insert(text, { block: true })` (core `insertMarkdownText`), with the `insert` text of the block
  definition (`insertTextFor`). The block gets a blank line before and after it. With no preset
  registered, the menu lists the components of the site.
- The Visual mode never rewrites the whole page with Tiptap. It cuts the page in blocks and keeps
  the text of each block that the author did not edit.

## Add a snippet (docs layer)

1. Add an entry to `MDC_SNIPPETS`: `id`, a full i18n key in `label`, an icon, `text`, `block`.
2. Add the key to `i18n/locales/en.json` and `pt-BR.json` of the docs layer under `docs.snippets`.
3. Update the id list in `test/mdc-snippets.test.ts`.

The `label` must be a full literal key (`docs.snippets.note`). The locale test scans
the code for literal keys.
