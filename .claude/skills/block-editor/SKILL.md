# Block editor

The block editor is the Visual mode of the `blocks` field widget of core. It edits a Markdown
body (a page of the docs layer, or any rich text field with `widget: 'blocks'`) as blocks, with a
live preview of the page. It works on every backend: it has no Nuxt Content import. The author never sees MDC, YAML or raw keys, except in
the Advanced section and in "Edit as Markdown". It uses the pure
[block model](../block-model/SKILL.md). Read that skill first.

## The layout

A type that uses the editor sets the core `canvas` form layout (see the `admin-view-chrome`
skill). The docs type does.

- Left panel: the block list (`PlutoBlockOutline`), with Undo, Redo, Add, and the Visual and
  Markdown switch.
- Center (the canvas): the live preview (`PlutoBlockPreviewFrame`, an iframe).
- Right panel, tab **Block**: the controls of the selected block (`PlutoBlockInspector`). Tab
  **Page**: the other fields (title, description, path, navigation, SEO). Core makes the tab.
- Below `lg` (64rem), both panels are slideovers. A choice in the block list closes that slideover
  and opens the Block panel.

## Files

All paths are in `packages/core`.

- `app/components/Pluto/Content/fields/PlutoFieldBlocks.vue`: the widget. Core registers it as
  `{ id: 'blocks', widget: 'blocks' }` in `pluto-core-registrations.ts`. It picks Visual or Markdown.
  Visual loads on demand (`defineAsyncComponent`), so Tiptap and the remark parser stay out of the
  other admin pages.
- `app/components/Pluto/Block/`:
  - `PlutoBlockEditor.vue`: the root. It makes the state, provides it, and fills the canvas and
    the two panels with `PlutoContentCanvasPanel`. It also handles Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z.
  - `PlutoBlockOutline.vue`, `PlutoBlockOutlineList.vue`: the list. Each list is one SortableJS
    group, so a block moves inside its own list only. Keys: Up and Down move the focus,
    Alt+Up and Alt+Down move the block, Delete removes it (Undo brings it back), Left and Right
    hide and show the blocks inside a component. A chevron before the icon does the same
    (`editor.collapsedIds`, `editor.toggleCollapsed`; not kept after a reload). A selection opens
    its collapsed parents, and a block selected in the preview scrolls its row into view.
    The whole row is the drag handle (`data-block-drag`); there is no grip icon. The chevron and the
    menu button do not start a drag (`data-block-nodrag`, SortableJS `filter`). A drag starts after
    a move of 4px (`fallbackTolerance`), so a click still selects. On touch, a press of 200 ms starts
    it (`delayOnTouchOnly`), so a swipe still scrolls the list. The label has a `title` (the label and
    the excerpt), so a truncated row can be read.
    The dots menu of a row shows on row hover (`group`). It changes only `opacity`, so the rows do
    not move. On a device without hover (`[@media(hover:hover)]:opacity-0` applies only with hover),
    with the keyboard focus in the row (`group-focus-within`), and while the menu is open
    (`data-[state=open]`), it stays visible.
    The "Add <child>" button of a child list is always visible.
    A row: the chevron (16px), the icon, the title, the menu. A list keeps the chevron column only
    when one of its blocks has children (`hasChevrons`), so a list of leaves (the cards of a slot)
    does not push its titles right. The line of a child list (`ms-2.5`, 10px) is under the center
    of the chevron.
    The panel has the side panel surface of core (`bg-pluto-panel`: a light gray, `#0b0b0b` in dark). The list scrolls in a Reka UI scroll area
    (`ScrollAreaRoot` with `type="hover"`, a 10px scrollbar with a rounded thumb). `reka-ui` is a
    dependency of core, on the version that Nuxt UI uses.
    The type declares the panel (`form.leftPanel` with the label and the same background), so
    core shows a panel skeleton while the page or the editor code loads.
  - `PlutoBlockPreviewFrame.vue`: while the preview loads, core's page skeleton
    (`PlutoSkeletonCanvas`) and a status pill at the bottom. The preview page
    (`pages/_pluto/preview.vue`) has a thin scrollbar (`scrollbar-width: thin`, a gray thumb).
  - `PlutoBlockMarkdownSplit.vue`: the mode switch is in a fixed footer under the source pane, as
    in the Visual mode. The split handle is the 6px handle of core (a 1px line, a 6px bar).
  - `PlutoBlockPalette.vue`: "Add a block". A `UCommandPalette` in a modal.
  - `PlutoBlockInspector.vue`: Content (one control for each slot), Settings, Advanced, actions.
  - `PlutoBlockPropControl.vue` (in core, `app/components/Pluto/Block/`, imported with
    `#layers/pluto/...`; the post editor of core uses it too): one setting. The control follows the
    prop type. A prop `default` shows as the placeholder, as "Default (value)" in a choice, and as the
    state of the switch. Its texts are `pluto.blocks.*` of core.
  - `PlutoBlockTextEditor.vue`: core `UEditor` with the shared `usePlutoMarkdownToolbar`. The
    Tiptap history is off. It writes only after the author acts (see "Byte for byte").
  - `PlutoBlockRawEditor.vue`: a Markdown box (`PlutoMarkdownSource`).
  - `PlutoBlockModeSwitch.vue`: Visual or Markdown.
  - `PlutoBlockPreviewFrame.vue`: the iframe and the messages to it.
  - `PlutoPreviewBlock.vue`: one block in the preview page, in an error boundary.
- `app/pages/_pluto/preview.vue`: the preview page.
- `app/components/PlutoContentPreview.vue`: the frame around the blocks. A site can override it.
- `app/composables/pluto-content-preview.ts`: `usePlutoPreviewRender` and `plutoPreviewRenderKey`.
- `app/composables/pluto-block-editor.ts`: `createPlutoBlockEditor` (the state),
  `usePlutoBlockEditor`, `usePlutoBlockSources`, `usePlutoBlockLabels`.
- `app/components/Pluto/Block/PlutoBlockSnippetMenu.vue`: the **Insert** menu of the Markdown mode.
  It lists the blocks of the palette (`listPaletteBlocks`) and inserts their `insert` text.
- `shared/utils/blocks/editor.ts`: pure helpers (`describeBlock`, `resolveSlotMode`,
  `slotMarkdown`, `toPreviewBlocks`, `buildPalette`).

## The state

`createPlutoBlockEditor({ source, emit, sources })` keeps the doc in an undo history. It also owns the
block sources (`editor.sources`, a `PlutoBlockSources`). The palette, the preview frame and the
labels read them from the state, not from the app config. `usePlutoBlockSources(componentBlocks)` gives the getter
that the two root components pass in. They import `componentBlocks` from the virtual module
`#pluto-blocks` of core (the blocks of the site components, see the block-model skill). Only these two files
import it, so the data stays in the lazy editor chunk. Each action
(insert, remove, duplicate, move, set prop, set slot, update text or code, replace with Markdown)
builds a new doc, writes the text with `serializeBlocks`, and calls `emit`. It never calls `emit`
on open. When the text changes from outside, it reads the doc again and clears the history.
Typing in one block, or in one setting, joins in one undo step (600 ms).

## Byte for byte

Open and save with no edit changes nothing, so the Git CMS makes no commit.

- The state never emits at the start. `test/block-editor-state.test.ts` checks the 48 pages.
- Tiptap writes the Markdown in its own form when it loads a text. `PlutoBlockTextEditor` ignores
  an update until the author does something in the editor (a key, a click, a paste, a drop), and
  ignores the echo of an outside change (Undo).
- One edit changes only the lines of that block (see the block model skill).

## The preview

A same-origin iframe of `/_pluto/preview`. The page parses each changed block with Comark
(`parseMarkdown` of `comark`, with `autoUnwrap: false`, so a component slot keeps its `<p>` as in MDC)
and renders it with `MarkdownDocument` of `@comark/vue` (`PlutoPreviewBlock`). A `.comark-content`
wrapper of each block has `display: contents`. It fetches nothing. The editor's own parser
(`parse.ts`, remark) stays: it needs exact source positions.

- The components come from `#pluto-content-components` (see "Constraints"), through the
  `componentsManifest` of `MarkdownDocument`. A layer adds names with the hook `pluto:blocks:components`
  (the docs layer adds the Nuxt UI `u-*` components of its presets). `Prose*` components that the app
  registers as global components render the HTML tags. Any other tag renders as an unknown element.
- Core's `nuxt.config.ts` has the route rules for `/_pluto/preview`: `ssr: false`, `prerender: false`,
  `x-robots-tag: noindex`. An app rule for the same path wins.
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
  Comark.
- A block that throws shows a small card ("This block could not show in the preview"). A block with
  `preview: false` in `plutoBlocks` shows the same card with a note.
- The page is the generic `PlutoContentPreview` (`UContainer`, `UPageHeader` with the title and the
  description, `UPageBody`). To show the real layout of the site, put
  `app/components/PlutoContentPreview.vue` in the app. It gets `frontmatter` and renders the default
  slot where the blocks go. The slot must hold the blocks directly, because the prose styles read
  the first and last child.
- A page that the site renders with other options (for example a landing with `:prose="false"`)
  must use the same options in the preview, or a component shows twice (a `prose-pre` with a code
  fence inside gets two frames). In the site's `PlutoContentPreview`, call
  `usePlutoPreviewRender(() => ({ prose: false, components: { a: 'prose-a' } }))` for that page.
  `prose: false` maps each `Prose*` name to its HTML tag. A `components` value is the name of a global
  component.
  `frontmatter.id` is the content id (`index` for the landing). `PlutoPreviewBlock` reads the
  options with `inject(plutoPreviewRenderKey)`.

## The site config

A site names its own components in `app.config.ts`, key `plutoBlocks` (see the block model skill).
This is the "overrides" layer of the block sources. A layer can also add presets with
`definePlutoExtension({ blockPresets })` (the docs layer adds the Nuxt UI blocks that way). It wins over the component layer, which the
build step will fill from the component files (it is empty for now). The palette shows them, the list shows their label and icon, and the Block panel shows their
settings and slots. Slot content kinds: `rich` (text editor), `inline` (one line), `blocks` (a
list with "Add"). A `rich` or `inline` slot becomes a Markdown box when its content has syntax that
the text editor would lose, and a block list when it holds a component or code.

A prop with `slot` (for example the `label` of `u-button`, with `slot: 'default'`) is one field for
the prop and that slot, in Settings. The slot does not show in Content. The field edits the slot
when the selected block has text in it (Markdown often writes a button as `:::u-button` with the
text inside, and the slot wins on the site), else the prop. The panel chooses when the block is
selected, so clearing the field does not move the text to the other place.

## The Image block

`pluto-figure` (palette group **Media**, label "Image"): `app/components/content/PlutoFigure.vue` of
the docs layer, so every docs site has it. `::pluto-figure{src alt caption dark :width :height}`: a
figure with a rounded ring, the `dark` image with `dark:hidden` / `dark:block`, a caption, and a
dashed placeholder with no `src`. A `/` path gets the base URL of the site. (`pluto-image` would
hit the global `PlutoImage` of core.)

- **The `media` prop type:** the control (`PlutoBlockPropControl`) shows the image, **Choose from
  the media library** (`PlutoMediaPicker` of core, `accept: ['image/*']`, only when the app has a
  media driver), **Remove**, and the URL field (for an image from elsewhere).
- **`fills`** on the prop definition names the props that a choice also sets: `{ width, height,
alt }` (`alt` only while it is empty). The control emits `media` with the record; the inspector
  (`setMedia`) calls `editor.setProps(id, patch)`: one undo step (`setProps` of the block model).
- **The Markdown keeps the URL**, not the media id: a static site needs no API call, and the page
  stays plain MDC.

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

Core (`packages/core/test/`): `block-editor-sources.test.ts` (the state with a component layer: no emit on
open for the 48 pages, and an edit of a kebab prop changes only that token), `blocks-preview-marks.test.ts`
(the marks and the corpus), and the model tests (see the block model skill).

Docs layer (`packages/layers/docs/test/`, they need the Nuxt UI presets): `block-editor-state.test.ts`
(no emit on open for the 48 pages, each action, Undo and Redo), `blocks-editor-helpers.test.ts` (labels,
excerpts, slot editors, preview blocks, palette), `docs-type.test.ts` (the canvas layout and the View
link). The locale tests check the keys of the UI.

## Constraints that the code does not say

These came from code comments. Keep them true when you change the code.

- **Preview ring:** the highlight box has the size of the block, and the ring is an inset box shadow
  (`insetRing`). A border on a larger box gives a horizontal scroll for a full-width block (a hero, a
  page section), and the inset ring keeps all four sides on screen.
- **Boxes of an element:** an element with no area gives the box of its children. A linked Nuxt UI card
  (`UPageCard` with `to`) puts the attributes on an inline link of 0 px width, and a child of that link
  covers the card.
- **Marks:** a component with more than one root element drops the mark, so the nearest marked parent
  shows. A text block inside a component has no mark, so the editor sends the deepest component on the
  path of the selection.
- **Parse cache:** the preview caches the parsed body by block id, text and inner ids. The same text gives
  the same object, so Vue does not render a block that did not change. The inner marks change the new
  parse in place, so never mark a cached body.
- **`postMessage`:** the front matter of the form holds reactive proxies, and `postMessage` cannot clone
  a proxy. `withoutReactiveProxies` makes a plain JSON copy.
- **The preview frame:** a style or a script has no box. The pointer over the iframe goes to the frame
  and the drag of the split stops, so the preview takes no pointer events while the handle moves. The
  split saves its size when the drag ends. It reads the saved size once: a reactive `defaultSize` would
  rebuild the panels on each save.
- **The split handle:** a 1px line. A `::before` 2.5px wider on each side is the 6px grab area. The bar
  fades in after 300ms of hover and shows at once while dragging. The `!` keeps the duration and the
  delay against the no-transition rule of the admin (`pluto-layer.css`).
- **Outline list:** SortableJS uses mouse events (not the browser drag and drop), the same on every
  browser and on touch. It moves the DOM node, so the code puts it back and lets Vue render the new
  order. When a row is gone, the focus goes to the block that the editor selects next, so Undo keeps
  working. A list row that moves in the DOM loses the focus, so the editor gives it back.
- **Selection:** a block selected in the preview scrolls its row after the render (`flush: 'post'`),
  because the editor opens the collapsed parents first. A selection in the panel or the preview opens
  the parents.
- **Undo keys:** one undo stack for the page. Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or Ctrl+Y) act while the
  focus is in the editor. In the Page tab the browser keeps its own undo. The text editor hides its
  Undo and Redo group, because the page has its own.
- **Text editor:** Tiptap writes the Markdown in its own form when it loads a text, and when the text
  changes from outside (Undo). That is not an edit. Only an update after an action of the author goes
  up, so opening a block never changes it.
- **Props and slots:** a prop with `slot` is edited in the slot when the block has text in it, else in
  the prop. The panel chooses when the block is selected, so clearing the field while typing does not
  move the text to the other place.
- **App config:** Nuxt types `useAppConfig()` from the literal config, where `'inline'` is a `string`, so
  `plutoBlocks` is read through `usePlutoBlocksConfig`.
- **Editor state:** it reads the text again, and clears the history, when the text changes from outside
  (a reload, a switch from the Markdown mode).
- **Types of props:** the parser gives every prop as text. The preview converts each prop to the type of
  its definition before it renders (`coerceNodeProps`, `coerceBlockProps`): `number` and `boolean`
  props only. A bare attribute is `true`.
- **Content components:** `#pluto-content-components` lists every component of a `components/content/`
  folder, and the names that a layer adds with the build hook `pluto:blocks:components`. The preview and
  the public `PlutoBlocks` both use it (through `usePlutoBlocksRender`). `#pluto-block-components` lists only
  the components that call `definePlutoBlock`, for the post content components.
