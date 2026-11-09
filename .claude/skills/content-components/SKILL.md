# Content components

An author can put a component of the site in the body of a post. The Visual editor shows it as a
chip, a click opens its props form, and the site (and the live preview) renders the component. A
component opts in with `definePlutoBlock(...)` in its file of `components/content/`: the same rule
as the block editor of the docs layer, which uses the same catalog.

## The Markdown

The MDC block form of Nuxt Content, with inline props and no content:

```md
::promo-card{title="Spring sale" :count='3' featured}
::
```

- Blank lines between the two lines are allowed. Up to three spaces before each line. The closing
  line has the same colons as the opening line.
- Props: `key="text"`, `:key='json'` (a number, a list, an object), `key` alone (`true`). The parser
  is `parseInlineProps` (`shared/utils/blocks/mdc-props.ts`).
- Only at the top level. A component with content (a slot), a YAML props block, or a component in
  another one keeps the old rule: the renderer shows its text (`stripMdc`), and the Visual editor is
  off for the text (`findUnsafeMarkdown`, `mdc-block`).

## Files

- `shared/markdown/component.ts`: `matchEmptyComponent(src, { safe? })` (the empty component at the
  start of the text), `componentStart`, `writeEmptyComponent(name, props, { braces, colons })` (an
  unchanged prop keeps its source text), `safeComponentProps`, `isSafePropName`,
  `componentMarkerHtml`, `readComponentMarker`, `PLUTO_COMPONENT_ATTRIBUTE`,
  `PLUTO_COMPONENT_PROPS_ATTRIBUTE`. Pure.
- `shared/markdown/url-safety.ts`: `decodeEntitiesOnce`, `isSafeUrl` (the sanitizer re-exports them).
- `shared/markdown/render.ts`: `plutoComponentExtension()` (the marked extension); `stripMdc` keeps an
  empty top-level component.
- `shared/markdown/sanitize-html.ts`: a `div` with a valid mark keeps the name and the props (parsed,
  filtered, written again), and no children. Any other `div` is unwrapped, as before.
- `shared/utils/embed.ts`: `splitBodyHtml` gives a `component` part for a mark; `hasComponentMarker`.
- `shared/utils/markdown-syntax.ts`: `findUnsafeMarkdown` skips the lines of an empty component with
  no indent.
- `shared/utils/blocks/`: `definition.ts` (the definition types, `blockKey`, `camelKey`,
  `humanizeName`, `sameKey`, `mergeBlockPatch`, `BLOCK_COLORS`), `define.ts` (`definePlutoBlock`),
  `component-meta.ts` (`blockFromComponentMeta`), `mdc-props.ts`.
- `shared/types/pluto-blocks.d.ts`: the types of the two virtual modules.
- `modules/pluto-blocks/`: `index.ts` (the module) and `catalog.ts` (`findContentComponents`,
  `readBlockEntry`, `BlockCatalog`, `blockComponentFiles`, `blocksModuleSource`,
  `componentsModuleSource`).
- `app/components/Pluto/PlutoHtml.vue`: renders a mark.
- `app/utils/pluto-content-component-node.ts`: `PlutoContentComponentNode`, the Tiptap node.
- `app/composables/pluto-content-components.ts`: `usePlutoContentComponents()` (the insert list),
  `plutoContentComponentInfo(name)`, and the open-after-insert flag.
- `app/components/Pluto/Block/`: `PlutoBlockChip.vue` (the node view), `PlutoBlockInsertMenu.vue`
  (the toolbar menu, a `slot: 'component'` item of `usePlutoMarkdownToolbar({ component: true })`),
  `PlutoBlockPropControl.vue` (one setting; the docs layer uses it too).
- Texts: `pluto.blocks.*`.

## Discovery

- Opt-in. A component in `components/content/` is a block only when its file calls
  `definePlutoBlock(...)`. The call can be `definePlutoBlock({})`: the props and slots still come from
  the types. `label`, `icon`, `description`, `hidden` and prop patches come from the call.
- The folders are `components/content/` of the app and of every layer, with the app first. When two
  files have the same name, the first one wins. `Prose*` files and `.client` / `.server` variants are
  skipped. The block key is the kebab name (`PromoCard` gives `promo-card`).
- A cheap text check (`hasBlockMacro`) runs before the parser. Only a file that passes is parsed, with
  `getComponentMeta` of `nuxt-component-meta/parser` and the `extendMetaFunctions` hook. The module does
  not install the `nuxt-component-meta` module (no `/api/component-meta` routes). `nuxt-component-meta`
  is a dependency of core, pinned to the version of `@nuxt/content`.
- `definePlutoBlock` is an auto-import. At run time it returns its argument. The parser reads the call
  as a statement: an object literal, with constants imported from a file. A local variable is not
  read. A parse error, or an argument that is not read, gives one warning and no block for that file.
- The meta reader gives no prop label: an editor shows its own label (the docs layer adds the shared
  labels of its presets), else the humanized name.
- `BlockCatalog` caches by file text. The parser also keeps a disk cache in
  `<buildDir>/cache/pluto-blocks`; it does not see a change in a file that the component imports.
  Delete that folder after such a change.
- Two Vite virtual modules (the resolved ids have no `#`, because a browser URL stops at the `#`):
  - `#pluto-blocks`: the definitions. Only the editors import it (the lazy chunks). The server build
    gets `{}`. The parser loads with the first import, not at start-up.
  - `#pluto-block-components`: `{ 'promo-card': () => import('<file>') }` for the files with the macro
    (the text check, no parse), on the server and the client. `PlutoHtml` imports it.
  - A new, removed or changed component file loads both again.
- Time: the first parse in a run costs about 1 s (the TypeScript checker starts), each next component
  about 0.5 s.

## Render

- `renderMarkdown` (core, the Git CMS) and the Markdown path of supabase-blog use
  `plutoComponentExtension()`. An empty top-level component becomes
  `<div data-pluto-component="promo-card" data-pluto-props="{json}"></div>`.
- **Safety.** The props pass `safeComponentProps` in the renderer, the sanitizer and the reader of
  `PlutoHtml`: a name `[a-z][\w-]*`, never `on…` (Vue binds `onClick` as a listener, and a prop that
  falls through to an element is a handler), `style`, `key`, `ref`, `is`, `innerHTML`,
  `textContent`, `innerText`, `outerHTML`; a value that is text, a number, a boolean, or a list or an
  object of them; a `javascript:`, `vbscript:` or (not image) `data:` URL goes, also inside a list or
  an object. The component gets no more than an author can write. The developer opts the component
  in, so its props are the developer's API.
- `PlutoHtml`: a body with a mark renders part by part (`splitBodyHtml`), the top level flat for
  `.pluto-prose`. A mark becomes the component of `#pluto-block-components` (`defineAsyncComponent`,
  one per name for the app), with the props and `data-pluto-component`. A name with no block
  component renders nothing. The server renders the component (SSR).
- The admin preview of a post uses `PlutoHtml`, so it shows the component.

## Editor

- `PlutoContentComponentNode` (`plutoComponent`): a block atom, draggable. Attributes `name`, `props`,
  `braces` (the source text of the props) and `colons`; none is rendered as an HTML attribute.
  `markdownTokenizer` reads the form above with `{ safe: false }` (the editor keeps every prop the
  author wrote; the site filters them), and `renderMarkdown` writes it with `writeEmptyComponent`, so
  an unchanged prop keeps its text. `parseHTML` and `renderHTML` use the mark. The command
  `insertPlutoComponent(name)` inserts an empty component and opens its form.
- `PlutoBlockChip`: the icon and the label of the definition (else `i-lucide-puzzle` and the
  humanized name), the first two text props, and a "Not found" badge for a name with no block
  component. A click opens a `UPopover`: the description, a `PlutoBlockPropControl` for each prop of
  the definition (with the spelling of the Markdown: `star-count` for `starCount`), then the other
  props of the Markdown (by their value), and **Remove**. A `media` prop with `fills` sets the size
  and the alt text too.
- After an insert from the menu, the new chip opens its form one frame later. The menu does not give
  the focus back to its button on close (`onCloseAutoFocus` prevented), else the form would close.
- `PlutoFieldMarkdown` (the Visual editor of the Git CMS) adds the node, and the **Insert a
  component** menu when the site has a visible block component. A layer editor (the `PostEditor` of
  supabase-blog) adds `PlutoContentComponentNode` to its extensions and `PlutoBlockInsertMenu` to its
  toolbar.

## Not in this version

- A slot (content inside the component). A YAML props block in the Visual editor.
- A component inside another one, or inside a list.

## Tests

- `test/content-components.test.ts`: the match, the safe props, the mark, `renderMarkdown`, the
  sanitizer, `writeEmptyComponent`.
- `test/markdown-syntax.test.ts`: an empty top-level component is safe for the Visual editor.
- `test/blocks-discovery.test.ts`, `test/blocks-discovery-parser.test.ts` (the real parser on
  `test/fixtures/discovery/`, the slow test), `test/blocks-component-meta.test.ts` (fixtures in
  `test/fixtures/component-meta/`).
