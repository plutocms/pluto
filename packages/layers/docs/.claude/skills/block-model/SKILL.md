# Block model

The block model cuts the Markdown (MDC) body of a page into blocks, edits the blocks, and writes
the text back. It is the base of the visual block editor. The code is pure: it has no Nuxt import.
It lives in `shared/utils/blocks/`. The UI is the [block editor](../block-editor/SKILL.md).

## The rule

The truth is the Markdown string. The model never writes the whole page again from a tree. A block
that is not edited keeps the source text it came from (`original`), and the gaps between the blocks
keep the text too. A save with no edit writes the same bytes. One edit changes only the lines of
that block. A test guards this with the 48 pages of the docs site.

## Files

- `types.ts`: `PlutoBlockDoc`, the four kinds of block, and the types of a block definition.
- `parse.ts`: `parseBlocks(source)`. It uses `remark-parse`, `remark-gfm` and `remark-mdc`.
- `serialize.ts`: `serializeBlocks(doc)`, `renderBlock(block)`.
- `mdc-props.ts`: reads and writes the props: `{a="b" .c #d flag :n='3'}` and the YAML block.
- `operations.ts`: pure, immutable edits. Each returns a new doc.
- `history.ts`: undo and redo over doc snapshots. The clock is a parameter.
- `presets.ts`: the Nuxt UI prose and page components, with i18n keys.
- `registry.ts`: `resolveBlockDefinition`, `listPaletteBlocks`, `definePlutoBlock`, `blockKey`.
- `component-meta.ts`: `blockFromComponentMeta`, `componentBlockName`. It makes a block definition
  from the meta of a Vue component (see "Component meta").
- `preview-protocol.ts`: the `postMessage` types and validators for the preview frame.
- `editor.ts`: helpers for the UI (labels, slot editors, preview blocks, palette).
- `tree.ts`: `flatChildren`, `walkBlocks`, `findBlock`, `pathOf`, `newBlockId`.

## The kinds of block

- `text`: prose. One block for each H1 or H2 section at the top level. In a component, all the
  prose between two other blocks is one block.
- `code`: a fenced code block. `lang`, `filename` (from `[file.ts]`), `meta`, `fence`, `code`.
- `component`: a container component (`::name`). It has `props`, `propsStyle` (`inline` or `yaml`),
  `propOrder`, `slots`, and `gaps`.
- `raw`: Markdown that the editor does not edit. The `reason` is `table`, `html`, `inline-mdc`,
  `footnote`, `task-list` or `unknown`. A raw block is still written back byte for byte.

## How a component is kept

- The children of all slots are in one list in source order. `slots` splits that list by slot name.
  `gaps` has the text before, between and after the children. It holds the `#name` lines.
- `openerText` is the opening line (and the YAML block). While the props are the same, it is
  written as it was. `propSource` has the source text of each prop, so a changed prop does not
  rewrite the others.
- A nested component has more colons than its parent. The model raises the colons when it moves or
  inserts a block into a parent.
- `indent` is the white space before the first line of a block inside a component.

## Operations

`insertBlocks`, `insertBlock`, `removeBlock`, `moveBlock`, `duplicateBlock`, `updateText`,
`updateCode`, `setProp`, `setSlot`, `replaceWithMarkdown`, `blocksFromMarkdown`, `blockMarkdown`,
and the makers `createTextBlock`, `createCodeBlock`, `createComponentBlock`.

- An edit removes `original` from the block and its ancestors. The other blocks keep theirs.
- A move in one list changes only the order of the blocks. The gaps stay in place.
- A no-op edit returns the same doc object.
- Pass plain objects. The functions copy the doc with JSON, so a Vue proxy also works.

## Block definitions

`resolveBlockDefinition(name, { sources, block })` joins the layers into one definition. The order,
low to high:

1. the preset (or an automatic entry for an unknown component),
2. the component layer (`sources.components`), made from the component files,
3. the site override (`sources.overrides`): `plutoBlocks` in `app.config.ts`,
4. the props and slots found in the document (`block`). They fill only what is missing, in the
   Advanced section.

`PlutoBlockSources = { components?, overrides? }` is the one object that carries the layers. The
palette, the preview, the labels and the editor state all take it. The component layer comes from
the module (see "Discovery").

Rules of the merge:

- A layer is a partial definition. Props and slots join key by key (shallow). A site can change only
  the `label` of a prop that the component layer typed.
- `false` for a prop or a slot removes it. `false` for a whole block hides it (`hidden: true`).
  `{ hidden: false }` in a higher layer shows it again.
- A prop that no layer types is a `string`.
- A prop can have a `default`. It is a hint for the control. It never goes into the Markdown.
- Names: the key is the kebab name (`PlutoHero` is `pluto-hero`, `UPageCTA` is `u-page-c-t-a`).
  `blockKey` makes it. The lookup also takes the Pascal form that a page can use (`::PlutoHero`),
  and a config key in any form.
- Prop keys: a prop of the definition takes the spelling of the block. If the page has
  `star-count` and the meta has `starCount`, the definition key is `star-count`. So an edit changes
  the prop of the page. It never adds a second one.
- `listPaletteBlocks(sources)` lists the presets, then the names in `components`, then the names that
  only `overrides` has. A component shows in the palette only when it is in one of the layers
  (opt-in). Any other component keeps the automatic entry: it is not in the palette, and a page that
  uses it edits in Advanced.

`definePlutoBlock(def)` is a typed identity helper (`shared/utils/blocks/define.ts`, a file with no
other import). `definePlutoBlock<Props>({...})` checks that the keys of `props` are keys of `Props`. A label or a description is an i18n key
(`docs.blocks.<name>.label`) or a plain text.

Definitions never feed `parseBlocks` or `serializeBlocks`. The corpus test does not change when a
layer changes.

## Component meta

`component-meta.ts` is pure. The module (see "Discovery") reads the meta of a component with
`nuxt-component-meta`, and the object of its `definePlutoBlock({...})` call. It then calls
`blockFromComponentMeta(name, meta, macro?)`. The result is `{ name, definition }`: the block key
and the partial definition for the component layer. The macro wins over the meta, key by key.

The type of a prop gives the widget. `undefined` and `null` are removed first.

| Type                                                   | Widget                             |
| ------------------------------------------------------ | ---------------------------------- |
| `string`, named `icon` or ending in `Icon`             | `icon`                             |
| `string` or `RouteLocationRaw`, named `to` or `href`   | `link`                             |
| any other `string`; `string` or `number`               | `string`                           |
| `number`                                               | `number`                           |
| `boolean`                                              | `boolean`                          |
| a union of string literals                             | `select` (options in source order) |
| a union of theme colors                                | `color`                            |
| object, array, function, number literals, other unions | no widget                          |

- A prop with no widget is not in the definition. A page that sets it shows it in Advanced.
- A mapped prop goes in Settings. `advanced: true` in the macro moves it.
- A simple default (`300`, `"normal"`, `false`) becomes `default`.
- The JSDoc text of a prop is its `description`. The label is the shared key
  `docs.blocks.props.<name>` when the presets have one. Else the control shows the name in words.
- A slot with the `mdcUnwrap` binding (`<slot mdc-unwrap="p">`) gets `content: 'inline'`. Other
  slots get no `content`, so `resolveSlotMode` picks it from the page.
- The label of a block is the macro label, else the name in words. The meta has no description.

## Add a preset

1. Add a `block(...)` call to `presets.ts` with the group, the icon, the props, the slots, and the
   insert text.
2. Add `label` and `description` to `blocks.<name>` in `en.json` and `pt-BR.json`. A new prop
   or slot name needs a key in `blocks.props` or `blocks.slots`.
3. `test/blocks-registry.test.ts` checks the keys, the insert text, and unused texts.

## Discovery

The component layer is built at build time. The code is in `modules/pluto-docs/blocks.ts` (Node, no Nuxt
import) and `modules/pluto-docs/index.ts` (`setupBlockDiscovery`).

- Opt-in. A component in `components/content/` is a block only when its file calls
  `definePlutoBlock(...)`. The call can be `definePlutoBlock({})`: the props and slots still come from
  the types. A file without the call is not read, and it is not in the palette. A `plutoBlocks` entry in
  `app.config.ts` can still add any component.
- The folders are `components/content/` of the app and of every layer (the same folders as Nuxt
  Content), with the app first. When two files have the same name, the first one wins. `Prose*` files
  and `.client` / `.server` variants are skipped.
- A cheap text check (`hasBlockMacro`) runs before the parser. Only a file that passes is parsed, with
  `getComponentMeta` of `nuxt-component-meta/parser` and the `extendMetaFunctions` hook. The module does
  NOT install the `nuxt-component-meta` module, so there are no `/api/component-meta` routes.
  `nuxt-component-meta` is a direct dependency, pinned to the version of `@nuxt/content`.
- `definePlutoBlock` is an auto-import. At run time it returns its argument, so it does nothing. The
  parser reads the call as a statement: an object literal, with constants imported from a file. A local
  variable of the setup is not read. A parse error, or an argument that is not read, gives one warning
  with the file name, and no block for that file. The rest of the build goes on.
- `BlockCatalog` caches by file text. A changed file is parsed again, the others are not. The parser
  also keeps a disk cache in `<buildDir>/cache/pluto-blocks`. It does not see a change in a file that
  the component imports (a shared type). Delete that folder after such a change.
- The Vite virtual module `#pluto-docs/blocks` holds the layer. Only `PlutoBlockEditor.vue` and
  `PlutoBlockMarkdownSplit.vue` import it, and pass it to `usePlutoBlockSources(componentBlocks)`. So it
  is in the lazy editor chunk, not in the public pages. The server build gets `{}`. In dev it loads when
  the editor first loads, and a changed or new component file loads it again. The resolved id has no
  `#`, because a browser URL stops at the `#`.
- The module registers the virtual module and the auto-import even when the layer is off, so the editor
  files always resolve.
- Option `plutoDocs.blocks.discover` (default `true`). `false` makes the module empty.
- Time: the first parse in a run costs about 1 s (the TypeScript checker starts). Each next component
  costs about 0.5 s, because the parser makes a new checker for each call. Debug level logs the time of
  each component and the total. A shared checker would be faster, but `nuxt-component-meta` does not
  export the pieces for it.

## Tests

- `test/blocks-corpus.test.ts`: the 48 pages in `test/fixtures/mdc/` (copied from the docs site)
  write back byte for byte. The fixtures have `-text` in `.gitattributes`, so git keeps the bytes.
- `test/blocks-edit.test.ts`, `test/blocks-operations.test.ts`: one edit changes only that block,
  and every operation leaves a text that parses again and writes the same bytes.
- `test/blocks-parse.test.ts`, `test/blocks-history.test.ts`, `test/blocks-registry.test.ts` (the
  layers, the merge, the names, the palette), `test/blocks-preview-protocol.test.ts`.
- `test/blocks-discovery.test.ts`: the pure code of `blocks.ts` with a fake reader (the macro check, the
  folders, the warnings, the cache). `test/blocks-discovery-parser.test.ts`: the real parser on
  `test/fixtures/discovery/` (an app folder and a layer folder; a macro, no macro, a local variable, a
  `Prose` file, an imported constant). It is the slow test (about 4 s).
- `test/blocks-component-meta.test.ts`: the type table and the macro. The fixtures are the real
  parser output for three docs-site components, in `test/fixtures/component-meta/`
  (`nuxt-component-meta` 0.18.0, the version that `@nuxt/content` pins).

## Pinned versions

`remark-mdc`, `remark-parse`, `remark-gfm` and `unified` are pinned to the versions of `@nuxtjs/mdc`
0.23. The blocks are cut with `remark-mdc`, and the site renders with `@nuxtjs/mdc`. Change the pins
only when `@nuxtjs/mdc` changes them, and run the corpus test.

## Limits

- A component whose opening line spans lines, or has `[text]` after the name, or has no closing
  colons, is a raw block.
- A YAML comment between props is lost when that component's props change.
- An edited Text block uses `\n`. A page with `\r\n` keeps its bytes until a block is edited.
