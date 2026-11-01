# MDC field

The `mdc` field widget edits the body of a docs page in two modes: **Visual** (the block editor,
see the [block editor](../block-editor/SKILL.md) skill) and **Markdown** (raw Markdown, with an
**Insert** menu of MDC snippets). MDC is the Markdown syntax with components (`::note`,
`:icon{name=""}`).

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

The Markdown editor is `PlutoMarkdownCodeEditor` of `@plutocms/core` (CodeMirror 6). It came from
this layer; the post editor of core uses it too. The git-cms skill of pluto ("Markdown code
editor") describes it: the format shown as the author types, the MDC line colors
(`mdcLineKinds`), the quick formats (`formatMarkdown`) and their shortcuts, search and history.

- This layer uses the global component names, so a local pluto checkout (`PLUTO_CORE_PATH`) is
  the one that loads: `<LazyPlutoMarkdownCodeEditor>` in `PlutoFieldMdc` (on demand), and
  `<PlutoMarkdownCodeEditor>` in `PlutoBlockMarkdownSplit` (itself loaded on demand). The type of
  the template ref comes from `import type { PlutoMarkdownCodeEditor } from '#components'`.
- The `toolbar` slot (the Insert menu) gets `insert` and `focus`. Exposed: `insert`, `focus`,
  `reveal(start, end)` and `goToLine(line)`.

## Files

- `app/components/Pluto/Docs/PlutoFieldMdc.vue` — the widget.
- `app/components/Pluto/Docs/PlutoMdcInsertMenu.vue` — the Insert menu.
- `app/components/Pluto/Docs/Blocks/PlutoBlockMarkdownSplit.vue` — Markdown and preview side
  by side.
- `shared/utils/mdc-snippets.ts` — `MDC_SNIPPETS`, the snippets as pure data.
- `app/plugins/pluto-docs.ts` — registers the widget as `{ id: 'mdc', widget: 'mdc' }`
  with `defineAsyncComponent`.
- `test/mdc-snippets.test.ts` — checks that every block snippet closes.

## How it works

- It follows the field widget contract: props `field`, `modelValue`, `disabled`, and the
  `update:modelValue` event. It uses `UFormField`, like the core widgets.
- The Markdown mode uses `PlutoMarkdownCodeEditor` of core (above). It never parses or rewrites the text, so
  MDC stays as the author wrote it. (Core `PlutoMarkdownSource`, a textarea, is still the editor of
  `PlutoBlockRawEditor` in the Block panel.)
- It fills the `#toolbar="{ insert, focus }"` slot with `PlutoMdcInsertMenu`. A menu item calls
  `insert(snippet.text, { block })` (core `insertMarkdownText`). A block snippet gets a blank line
  before and after it. An inline snippet (`:kbd`, `:icon`) does not.
- The Visual mode never rewrites the whole page with Tiptap. It cuts the page in blocks and keeps
  the text of each block that the author did not edit.

## The snippets

Note, tip, warning, caution, callout, code group, tabs (with `tabs-item`), steps, card group (with
`card`), accordion, field group (with `field`), `:kbd{value=""}`, `:icon{name=""}`, and a code
block with a file name. A nested component uses more colons than its parent where needed
(`::tabs` holds `:::tabs-item`).

## Add a snippet

1. Add an entry to `MDC_SNIPPETS`: `id`, a full i18n key in `label`, an icon, `text`, `block`.
2. Add the key to `i18n/locales/en.json` and `pt-BR.json` under `docs.snippets`.
3. Update the id list in `test/mdc-snippets.test.ts`.

The `label` must be a full literal key (`docs.snippets.note`). The locale test scans
the code for literal keys.
