# Block editor

The block editor is the Visual mode of the `mdc` field. It edits the body of a docs page as
blocks, with a live preview of the page. The author never sees MDC, YAML or raw keys, except in
the Advanced section and in "Edit as Markdown". It uses the pure
[block model](../block-model/SKILL.md). Read that skill first.

## The layout

The docs type uses the core `canvas` form layout (see the `admin-view-chrome` skill in pluto).

- Left panel: the block list (`PlutoBlockOutline`), with Undo, Redo, Add, and the Visual and
  Markdown switch.
- Center (the canvas): the live preview (`PlutoBlockPreviewFrame`, an iframe).
- Right panel, tab **Block**: the controls of the selected block (`PlutoBlockInspector`). Tab
  **Page**: the other fields (title, description, path, navigation, SEO). Core makes the tab.
- Below `lg` (64rem), both panels are slideovers. A choice in the block list closes that slideover
  and opens the Block panel.

## Files

- `app/components/Pluto/Docs/PlutoFieldMdc.vue`: the widget. It picks Visual or Markdown.
  Visual loads on demand (`defineAsyncComponent`), so Tiptap and the remark parser stay out of the
  other admin pages.
- `app/components/Pluto/Docs/Blocks/`:
  - `PlutoBlockEditor.vue`: the root. It makes the state, provides it, and fills the canvas and
    the two panels with `PlutoContentCanvasPanel`. It also handles Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z.
  - `PlutoBlockOutline.vue`, `PlutoBlockOutlineList.vue`: the list. Each list is one SortableJS
    group, so a block moves inside its own list only. Keys: Up and Down move the focus,
    Alt+Up and Alt+Down move the block, Delete removes it (Undo brings it back), Left and Right
    hide and show the blocks inside a component. A chevron before the icon does the same
    (`editor.collapsedIds`, `editor.toggleCollapsed`; not kept after a reload). A selection opens
    its collapsed parents, and a block selected in the preview scrolls its row into view.
    The drag handle and the dots menu of a row show on row hover (`group`). They change only
    `opacity`, so the rows do not move. On a device without hover
    (`[@media(hover:hover)]:opacity-0` applies only with hover), with the keyboard focus in the row
    (`group-focus-within`), and while the menu is open (`data-[state=open]`), they stay visible.
    The "Add <child>" button of a child list is always visible.
    A row: the handle (16px), the chevron (16px), the icon, the title, the menu. A list keeps the
    chevron column only when one of its blocks has children (`hasChevrons`), so a list of leaves
    (the cards of a slot) does not push its titles right. The line of a child list (`ms-7`, 28px)
    is under the center of the chevron.
    The panel is `bg-white` / `dark:bg-[#0b0b0b]`. The list scrolls in a Reka UI scroll area
    (`ScrollAreaRoot` with `type="hover"`, a 10px scrollbar with a rounded thumb). `reka-ui` is a
    dependency of the layer, on the version that Nuxt UI uses.
    The docs type declares the panel (`form.leftPanel` with the label and the same background), so
    core shows a panel skeleton while the page or the editor code loads.
  - `PlutoBlockPreviewFrame.vue`: while the preview loads, core's page skeleton
    (`PlutoSkeletonCanvas`) and a status pill at the bottom. The preview page
    (`pages/_pluto/preview.vue`) has a thin scrollbar (`scrollbar-width: thin`, a gray thumb).
  - `PlutoBlockMarkdownSplit.vue`: the mode switch is in a fixed footer under the source pane, as
    in the Visual mode. The split handle is the 6px handle of core (a 1px line, a 6px bar).
  - `PlutoBlockPalette.vue`: "Add a block". A `UCommandPalette` in a modal.
  - `PlutoBlockInspector.vue`: Content (one control for each slot), Settings, Advanced, actions.
  - `PlutoBlockPropControl.vue`: one setting. The control follows the prop type. A prop `default`
    shows as the placeholder, as "Default (value)" in a choice, and as the state of the switch.
  - `PlutoBlockTextEditor.vue`: core `UEditor` with the shared `usePlutoMarkdownToolbar`. The
    Tiptap history is off. It writes only after the author acts (see "Byte for byte").
  - `PlutoBlockRawEditor.vue`: a Markdown box (`PlutoMarkdownSource`).
  - `PlutoBlockModeSwitch.vue`: Visual or Markdown.
  - `PlutoBlockPreviewFrame.vue`: the iframe and the messages to it.
  - `PlutoPreviewBlock.vue`: one block in the preview page, in an error boundary.
- `app/pages/_pluto/preview.vue`: the preview page.
- `app/components/PlutoContentPreview.vue`: the frame around the blocks. A site can override it.
- `app/composables/pluto-block-editor.ts`: `createPlutoBlockEditor` (the state),
  `usePlutoBlockEditor`, `usePlutoBlockSources`, `usePlutoBlockLabels`, `topLevelId`.
- `shared/utils/blocks/editor.ts`: pure helpers (`describeBlock`, `resolveSlotMode`,
  `slotMarkdown`, `toPreviewBlocks`, `buildPalette`).

## The state

`createPlutoBlockEditor({ source, emit, sources })` keeps the doc in an undo history. It also owns the
block sources (`editor.sources`, a `PlutoBlockSources`). The palette, the preview frame and the
labels read them from the state, not from the app config. `usePlutoBlockSources(componentBlocks)` gives the getter
that the two root components pass in. They import `componentBlocks` from the virtual module
`#pluto-docs/blocks` (the blocks of the site components, see the block-model skill). Only these two files
import it, so the data stays in the lazy editor chunk. Each action
(insert, remove, duplicate, move, set prop, set slot, update text or code, replace with Markdown)
builds a new doc, writes the text with `serializeBlocks`, and calls `emit`. It never calls `emit`
on open. When the text changes from outside, it reads the doc again and clears the history.
Typing in one block, or in one setting, joins in one undo step (600 ms).

## Byte for byte

Open and save with no edit changes nothing, so the GitHub CMS makes no commit.

- The state never emits at the start. `test/block-editor-state.test.ts` checks the 48 pages.
- Tiptap writes the Markdown in its own form when it loads a text. `PlutoBlockTextEditor` ignores
  an update until the author does something in the editor (a key, a click, a paste, a drop), and
  ignores the echo of an outside change (Undo).
- One edit changes only the lines of that block (see the block model skill).

## The preview

A same-origin iframe of `/_pluto/preview`. The page parses each changed block with the site parser
(`parseMarkdown` of `@nuxtjs/mdc`) and renders it with `ContentRenderer`, so the page looks as it
does on the site. It fetches nothing.

- The module adds the route rules: `ssr: false`, `prerender: false`, `x-robots-tag: noindex`. An
  app rule for the same path wins.
- The page sets `layout: false` and `plutoAdminBar: false` (no admin bar in the frame).
- A site that wraps all pages in a header and a footer must skip them on the preview path. Use the
  core `isPlutoPreviewPath(route.path)`, as the docs `app.vue` does with `AppShell`.
- Messages (`shared/utils/blocks/preview-protocol.ts`): `render` (after 150 ms of quiet), `select`
  and `scroll-to` to the frame, and `ready`, `select`, `hover`, `error` from it. Both sides check
  the origin, the source window, the version and the shape.
- Each top-level block gets `data-pluto-block="<id>"` on its elements. The frame draws the outline
  (selected and hover) around the union of those elements, with inline styles. A click selects the
  block, and the page does not follow links.
- Inner blocks: `toPreviewBlocks` sends the inner components of a component block as `children`
  (`PlutoPreviewChild`: `id`, `name`, `label`, `children`), in source order over all slots.
  `markPreviewChildren` (`shared/utils/blocks/preview-marks.ts`) puts their ids on the matching
  component elements of the parsed body: it looks only at the direct children of a component and
  the children of its `template` slots, and matches in order by name (`UPageCard` and
  `u-page-card` are the same). So an inline component in a paragraph never takes the place of an
  inner block. A click and a hover take the innermost marked element: a click on a card selects the
  card, not the card group. Esc in the frame selects the parent.
- Text, code and raw children have no mark. The editor sends the deepest component on the path of
  the selection (`previewSelectionId`), so a text inside a card shows the card. A component that
  drops the attribute (more than one root element) shows its nearest marked parent.
- Test: `test/blocks-preview-marks.test.ts` marks every inner component of the 48 docs pages with
  the site parser.
- A block that throws shows a small card ("This block could not show in the preview"). A block with
  `preview: false` in `plutoBlocks` shows the same card with a note.
- The page is the generic `PlutoContentPreview` (`UContainer`, `UPageHeader` with the title and the
  description, `UPageBody`). To show the real layout of the site, put
  `app/components/PlutoContentPreview.vue` in the app. It gets `frontmatter` and renders the default
  slot where the blocks go. The slot must hold the blocks directly, because the prose styles read
  the first and last child.
- A page that the site renders with other `ContentRenderer` options (for example a landing with
  `:prose="false"`) must use the same options in the preview, or a component shows twice (a
  `prose-pre` with a code fence inside gets two frames). In the site's `PlutoContentPreview`, call
  `usePlutoPreviewRender(() => ({ prose: false, components: { a: 'prose-a' } }))` for that page.
  `frontmatter.id` is the content id (`index` for the landing). `PlutoPreviewBlock` reads the
  options with `inject(plutoPreviewRenderKey)`.

## The site config

A site names its own components in `app.config.ts`, key `plutoBlocks` (see the block model skill).
This is the "overrides" layer of the block sources. It wins over the component layer, which the
build step will fill from the component files (it is empty for now). The palette shows them, the list shows their label and icon, and the Block panel shows their
settings and slots. Slot content kinds: `rich` (text editor), `inline` (one line), `blocks` (a
list with "Add"). A `rich` or `inline` slot becomes a Markdown box when its content has syntax that
the text editor would lose, and a block list when it holds a component or code.

A prop with `slot` (for example the `label` of `u-button`, with `slot: 'default'`) is one field for
the prop and that slot, in Settings. The slot does not show in Content. The field edits the slot
when the selected block has text in it (Markdown often writes a button as `:::u-button` with the
text inside, and the slot wins on the site), else the prop. The panel chooses when the block is
selected, so clearing the field does not move the text to the other place.

## Not in this version

- Typing in the preview. A click selects, and the panels edit.
- Selecting a nested block in the preview (a click selects the top-level container).
- A table grid (a table is a Markdown block), the build step that fills the component layer from
  the component files (the mapping is ready in `component-meta.ts`), an image control, a device width switch.
- A phone layout with the block list as the main view (the panels are slideovers).
- The overflow menu item for Visual and Markdown (the switch is at the bottom of the block list,
  and above the Markdown box).
- At 1024 to 1200 px, the two panels and the admin sidebar leave a narrow preview. Hide a panel
  with the toggles in the toolbar.

## Tests

- `test/block-editor-state.test.ts`: no emit on open for the 48 pages, each action, Undo and Redo.
- `test/block-editor-sources.test.ts`: the state with a component layer (no emit on open for the 48
  pages, and an edit of a kebab prop changes only that token).
- `test/blocks-editor-helpers.test.ts`: labels, excerpts, slot editors, preview blocks, palette.
- `test/docs-type.test.ts`: the canvas layout and the View link.
- The locale test checks the keys of the UI.
