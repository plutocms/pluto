# Blocks kit

`@plutocms/blocks` (`packages/layers/addons/blocks`) is the add-on layer with a landing kit for
pages: 22 content components with the prefix `block-`, a theme in `app.config.ts`, and one plain CSS
file. Like the other add-ons it does not extend core: the app brings core. It needs core 0.72.0 or
newer (an optional peer dependency). The block editor of core (see the block-editor skill) lists
the blocks in its palette, and the page body (`PlutoBlocks`) renders them.

An importer (a tool that turns the pages of another site into Pluto pages) writes MDC with these
blocks. The "MDC rules" and "Blocks" sections are its contract.

## Files

- `nuxt.config.ts`: `$meta.name: 'blocks'` and `css: [blocks.css]`.
- `app/assets/css/blocks.css`: all the CSS. Plain, in the `components` layer, one class per
  selector, variables on `:root`.
- `app/components/content/Block*.vue`: the 22 blocks. Each calls `definePlutoBlock<Props>({...})`
  with a literal object (the build reads it). `BLOCKS_LAYOUT_CHILDREN` of `app/utils/blocks-names.ts`
  is an imported constant, which the reader of core accepts.
- `app/components/BlockInline.vue`: takes the `<p>` out of an inline slot (the Markdown parser wraps
  a line in a paragraph, and a heading must not hold one).
- `app/utils/blocks-style.ts`: `blocksColor`, `blocksSpace`, `blocksLength`, `blocksPercent`,
  `blocksLevel`, `blocksUrl`, `blocksCssUrl`, `blocksLink`, `blocksSafeColor`, `blocksSafeFont`,
  `blocksUnwrapParagraphs`. Every value of a prop goes through one of them before it reaches a
  style or an attribute.
- `app/utils/blocks-theme.ts`: `blocksThemeCss(theme)`.
- `app/utils/blocks-names.ts`: the lists (`BLOCKS_WIDGETS`, `BLOCKS_LAYOUT_CHILDREN`,
  `BLOCKS_SPACES`, `BLOCKS_COLOR_TOKENS`, `BLOCKS_NETWORKS`).
- `app/plugins/blocks-theme.ts`: writes the theme with `useHead`, on the server too.
- `shared/types/blocks-theme.ts`: `PlutoBlocksTheme` and the `AppConfig` type.
- Tests in `test/`: `theme.test.ts`, `definitions.test.ts` (the real parser of core, the slow test),
  `render.test.ts` (an SSR render of `playground/content/pages/landing.md` through Comark).

## Why `plutoBlocksTheme` and not `plutoBlocks.theme`

`plutoBlocks` in `app.config.ts` is the block overrides of core: every key is a block name
(`usePlutoBlockSources`, `listPaletteBlocks`). A `theme` key there would show a block "Theme" in the
palette, and the `AppConfig` type of core (`Record<string, PlutoBlockOverride>`) rejects an object
that is not a block patch. So the theme has its own key.

## Theme

```ts
export default defineAppConfig({
  plutoBlocksTheme: {
    colors: { primary: '#0f766e', background: '#fffdf8' },
    fonts: { heading: '"Fredoka", sans-serif', body: 'system-ui, sans-serif' },
  },
})
```

- `colors`: `primary`, `secondary`, `text`, `accent`, `muted`, `surface`, `background`, `onPrimary`.
  Each becomes `--pluto-blocks-color-<name>` (`onPrimary` is `--pluto-blocks-color-on-primary`).
- `fonts`: `heading` and `body`, as `--pluto-blocks-font-heading` and `--pluto-blocks-font-body`.
- `blocksThemeCss(theme)` gives one `:root { ... }` rule, or an empty text. A name it does not know,
  and a value that is not a safe CSS color (a hex, a name, `rgb()`, `hsl()`, `oklch()`...,
  `color-mix()`, `var()`) or font stack (letters, digits, spaces, commas, quotes, `-`), is dropped.
  `url()`, `;`, `{`, `}`, `<`, `>`, `@`, a backslash and a comment never pass.
- The plugin `app/plugins/blocks-theme.ts` calls `useHead({ style })` with a `key`, so the server HTML
  has the rule, and a change of the app config in dev updates it. The rule is not in a cascade layer,
  so it beats the defaults of `blocks.css`.
- **Defaults** (in `blocks.css`, on `:where(:root)`): `primary` is `var(--ui-primary, #4f46e5)`,
  `secondary` `var(--ui-secondary, #64748b)`, `accent` `var(--ui-warning, #d97706)`, `text`
  `currentColor`, `muted` `color-mix(in oklab, var(--pluto-blocks-color-text) 65%, transparent)` (a section with `color` sets text and muted from that color),
  `surface` `var(--ui-bg-elevated, color-mix(in oklab, currentColor 6%, transparent))`, `background`
  `transparent`, `on-primary` `var(--ui-bg, #fff)`. They work in light and dark mode on a Nuxt UI site
  (its variables change with the mode) and on a plain site (they follow the color of the page).
  A fixed color in the theme is the same in both modes: that is the site's choice.
- Scale tokens: `--pluto-blocks-space-{xs,sm,md,lg,xl,2xl}` (`0.5rem`, `1rem`, `1.5rem`, `3rem`,
  `5rem`, `8rem`), `--pluto-blocks-radius-{sm,md,lg,xl,full}`, `--pluto-blocks-container` (`72rem`).

## Values

- **Scale** (`padding`, `gap`, `spacing`, `size` of a spacer): `none`, `xs`, `sm`, `md`, `lg`, `xl`,
  `2xl`, or a CSS length. A bare number is pixels. `none` is `0px` (a unitless `0` would break the `calc()` of the column widths).
- **Color** (`bg`, `color`, `overlay`...): a token (`primary`, `secondary`, `text`, `accent`,
  `muted`, `surface`, `background`) or a safe CSS color. Anything else is ignored, so an imported
  color stays exact.
- **Length** (`width`, `min-height`, `max-width`): a number (pixels) or a number with `px`, `rem`,
  `em`, `%`, `vh`, `vw`, `vmin`, `vmax`, `svh`, `dvh`, `ch`.
- **Link** (`link`, `url`, `src`, `image`): a path (`/pricing`), an anchor (`#faq`), `http:`,
  `https:`, `mailto:` or `tel:`. Another scheme (`javascript:`, `data:`) is ignored. A path gets the
  base URL of the site. `target="_blank"` adds `rel="noopener noreferrer"`.
- **Align** (`align`): `start`, `center`, `end` (the text, or the block inside its box). A left to
  right site: `start` is left.

## MDC rules for an importer

```md
:::block-column{width="50" padding="md"}
::block-heading{level="2"}
A title
::

::block-button{label="Go" link="/go"}
::
:::
```

1. **Colons.** A block opens with `::` and closes with the same number of colons. A block that holds
   blocks has more colons than any block inside it. Use `2` for a block with no child block, and
   `1 + the most colons among its children` for a block with children. A section that holds columns
   that hold a button has 5 colons (button 2, column 3, columns 4, section 5).
2. **Props.** `key="text"` for text, a bare `key` for `true` (`single`, `open`, `full`). `:key="false"`
   or `:key='json'` for a boolean `false`, a number or a list. A number prop also takes `key="3"`.
   A prop with a capital letter is written in kebab case: `min-height`, `overlay-opacity`,
   `max-width`. A value with a double quote uses single quotes: `title='A "quoted" word'`.
3. **Slots.** The text between the opening and the closing line is the default slot. A block with
   block children has them there, one after the other, with a blank line between them. The blocks of
   this kit use only the default slot.
4. **Inline slot** (`block-heading`, `block-icon-list-item`): one line of text, with `**bold**`,
   `_italic_`, `` `code` `` and `[links](/x)`. The block takes the paragraph away.
5. **Rich slot** (`block-text`, the text of `block-icon-box`, `block-image-box`,
   `block-accordion-item`, `block-testimonial`): any Markdown (paragraphs, lists, links, quotes,
   images). Raw HTML in it is sanitized on the server.
6. **No raw HTML** for layout: write a block. Comark parses raw HTML, but the public render
   sanitizes it.
7. **Order.** The order of the children is the order on the page. A section is a band of the page:
   put each band of the source in its own `block-section`.
8. **Unknown values.** A prop with a value that the kit does not know is ignored (no error). The
   block shows its default.
9. A page with a `block-image` that has no `alt` gets `alt=""`. An importer should report it.

## Blocks

The group is the palette group (`layout`, `text`, `media`, `landing`). A slot with `blocks` takes the
blocks in `accepts`. Defaults are in brackets.

### block-section (layout)

A band of the page. Slot `default` (blocks): `block-columns` and every widget.

- `tag`: `section` [default], `div`, `header`, `footer`, `article`, `aside`.
- `anchor`: the `id`, for `#pricing`.
- `bg`: color. `image`: a background image (`media`). `overlay`: a color over the image.
  `overlay-opacity`: 0 to 100 [50]. `color`: the text color.
- `padding`: scale [`lg`], the space above and below. `min-height`: length.
- `width`: `contained` [default] (the content has `max-width: 72rem`) or `full`. `max-width`: length.
- `align`: `start`, `center`, `end`: the text of the section.
- `valign`: `start`, `center`, `end`: the content, when the section is taller than it.

```md
::::block-section{anchor="top" bg="primary" color="#ffffff" padding="xl" align="center"}
::block-heading{level="1"}
Welcome
::
::::
```

### block-columns (layout)

A row. Slot `default` (blocks): `block-column`.

- `gap`: scale [`md`].
- `valign`: `stretch` [default], `start`, `center`, `end`: the columns when their heights differ.
- `wrap`: boolean [true]. `:wrap="false"` keeps one line.
- `stack`: `md` [default] (stack below 768 px), `sm` (below 640 px), `never`.

```md
::::block-columns{gap="lg" valign="center" stack="sm"}
:::block-column{width="50"}
::block-text
Left
::
:::

:::block-column{width="50"}
::block-text
Right
::
:::
::::
```

### block-column (layout)

One column. Slot `default` (blocks): `block-columns` (so columns nest) and every widget. The children
stack with a gap.

- `width`: a percent (`50`, `33.3`, `50%`) or a length (`320px`). With percents that add up to 100,
  the row fits exactly, gaps included. With no width, the column shares the free space.
- `padding`: scale [`none`]. `bg`: color.
- `radius`: `none` [default], `sm`, `md`, `lg`, `xl`, `full`. `shadow`: `none` [default], `sm`, `md`, `lg`.
- `align`: `start`, `center`, `end` (text). `valign`: `start`, `center`, `end` (the content, inside
  the height of the row).

```md
:::block-column{width="33.3" padding="md" bg="surface" radius="lg" shadow="sm"}
::block-icon{icon="i-lucide-zap"}
::
:::
```

### block-heading (text)

A real `h1` to `h6`. Slot `default` (inline): the text.

- `level`: `1` to `6` [`2`]. Another value gives `h2`.
- `size`: `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`. Empty: the size of the level. The look is separate from
  the level, so the page keeps its outline.
- `align`: `start`, `center`, `end`. `color`: color.

```md
::block-heading{level="2" size="xl" align="center" color="primary"}
Our **story**
::
```

### block-text (text)

Slot `default` (rich): Markdown.

- `size`: `sm`, `lg`, `xl` (empty: the size of the page). `align`: `start`, `center`, `end`. `color`: color.

```md
::block-text{align="center" color="muted"}
A paragraph with a [link](/about), and a list:

- One
- Two
  ::
```

### block-image (media)

A figure. No slot.

- `src`: the image (`media`). Nothing renders without it.
- `alt`: the text alternative [`""`]. `caption`: a `figcaption`.
- `width`: length (empty: the full width of its box). `radius`: `none` [default], `sm`, `md`, `lg`, `xl`, `full`.
- `align`: `start`, `center`, `end` (a narrow image inside a wide box).
- `link`: makes the image a link. `target`: `_self`, `_blank`.

```md
::block-image{src="/media/2026/11/team.jpg" alt="The team at the office" width="60%" radius="lg" align="center" caption="Our team"}
::
```

### block-button (landing)

An `<a class="pluto-blocks-button">` when it has a `link`, else a `<button type="button">`. No slot.

- `label`: the text. `link`: a path or URL. `target`: `_self`, `_blank`.
- `variant`: `solid` [default], `outline`, `link`. `size`: `sm`, `md` [default], `lg`.
- `align`: `start`, `center`, `end`: where the button sits in its box. `full`: boolean, the full width.
- `color`: color [`primary`]. `icon`: an icon name before the label.

```md
::block-button{label="Book a call" link="/contact" variant="outline" size="lg" align="center" icon="i-lucide-phone"}
::
```

### block-icon (media)

One icon, from the Nuxt UI icon sets of the site (`i-lucide-*` is always there). No slot.

- `icon`: [`i-lucide-star`]. `size`: `sm`, `md`, `lg` [default], `xl`, `2xl`. `color`: color [`primary`].
- `align`: `start`, `center`, `end`. `label`: the text alternative. Empty: the icon is hidden from a
  screen reader. `link`, `target`: make it a link (then give it a `label`).

```md
::block-icon{icon="i-lucide-heart" size="xl" color="accent" align="center" label="Favorite"}
::
```

### block-divider (layout)

An `<hr>`. No slot.

- `line`: `solid` [default], `dashed`, `dotted`. `color`: color. `thickness`: pixels [1].
- `width`: length (empty: the full width). `align`: `start`, `center` [default], `end`.
- `spacing`: scale [`sm`], above and below.

```md
::block-divider{line="dashed" width="40%" thickness="2" color="muted" spacing="md"}
::
```

### block-spacer (layout)

Empty space, hidden from a screen reader. No slot.

- `size`: scale [`md`] or a length.

```md
::block-spacer{size="48px"}
::
```

### block-video (media)

A video from a page URL, rendered by the embed providers of core (`embedProviders` of the registry:
YouTube and Vimeo). A URL that no provider knows renders as a link. No slot.

- `url`: the page of the video. `title`: its name for a screen reader, and the text of the fallback link.
- `ratio`: `16:9` [default], `4:3`, `1:1`, `21:9`, `9:16`. `width`: length. `align`: `start`, `center`, `end`.

```md
::block-video{url="https://www.youtube.com/watch?v=jNQXAC9IVRw" title="Product tour" ratio="16:9" width="80%" align="center"}
::
```

### block-icon-list (landing) and block-icon-list-item

A `<ul>`. Slot `default` (blocks): `block-icon-list-item`.

- `icon`: the icon of the items with no icon of their own [`i-lucide-check`]. `color`: the icon color [`primary`].
- `gap`: scale [`xs`]. `layout`: `vertical` [default], `inline`.

Item: slot `default` (inline) is the text. `text` is the same text as a prop (the slot wins).
`icon`: this item's icon. `link`, `target`: the text becomes a link.

```md
:::block-icon-list{icon="i-lucide-check" color="primary" gap="sm"}
::block-icon-list-item{text="Free shipping"}
::

::block-icon-list-item{icon="i-lucide-star" link="/reviews"}
Rated 5 stars
::
:::
```

### block-icon-box (landing)

An icon, a title and a text. Slot `default` (rich): the text.

- `icon`, `size`: `sm`, `md`, `lg`, `xl` [default], `2xl`. `color`: the icon color [`primary`].
- `title`. `level`: the heading level of the title, `1` to `6` [`3`]. `link`, `target`: a link on the title.
- `position`: `top` [default], `left`. `align`: `start`, `center`, `end` (with `position="top"`).

```md
::block-icon-box{icon="i-lucide-zap" title="Fast" level="3" align="center" color="accent"}
Pages load as plain HTML.
::
```

### block-image-box (landing)

An image, a title and a text. Slot `default` (rich): the text.

- `src` (`media`), `alt`, `radius`: `none` [default], `sm`, `md`, `lg`, `xl`, `full`.
- `title`, `level` [`3`], `link`, `target`. `position`: `top` [default], `left`. `align`.

```md
::block-image-box{src="/media/a.jpg" alt="A loaf of bread" title="Sourdough" position="left" radius="md"}
Baked every morning.
::
```

### block-accordion (landing) and block-accordion-item

`<details>` and `<summary>`: it works with no JavaScript. Slot `default` (blocks): `block-accordion-item`.

- `single`: boolean [false]. Open one item at a time (the items share a `name`).

Item: slot `default` (rich) is the answer. `title`: the question (the `<summary>`). `open`: boolean,
open when the page loads.

```md
:::block-accordion{single}
::block-accordion-item{title="Is it free?" open}
Yes.
::

::block-accordion-item{title="Can I cancel?"}
Any time.
::
:::
```

### block-testimonial (landing)

A `figure` with a `blockquote`. Slot `default` (rich): the quote.

- `name`, `role`. `image`: the photo (`media`; its `alt` is empty, the name is next to it).
- `align`: `start`, `center`.

```md
::block-testimonial{name="Ana Souza" role="Founder, Studio Lume" image="/media/ana.jpg" align="center"}
It took one afternoon.
::
```

### block-counter (landing)

A big number with a title. No slot. It does not animate.

- `value`: a number [0]. `prefix`, `suffix`: text around it (`$`, `+`, `%`). `title`: the caption.
- `color`: the number color [`primary`]. `align`: `start`, `center`, `end`.

```md
::block-counter{value="120" suffix="+" title="Projects" align="center"}
::
```

### block-social-icons (landing) and block-social-link

A `<ul>` of icon links. Slot `default` (blocks): `block-social-link`.

- `shape`: `plain` [default], `circle`, `square`. `size`: `sm`, `md` [default], `lg`, `xl`.
- `gap`: scale [`sm`]. `color`: color [`primary`]. `align`: `start`, `center`, `end`.

Link: `network`: `facebook`, `instagram`, `linkedin`, `twitter`, `youtube`, `github`, `gitlab`,
`twitch`, `dribbble`, `figma`, `slack`, `telegram`, `email`, `phone`, `rss`, `website` [default]. `url`.
`label`: the name for a screen reader [the name of the network]. `icon`: an icon of your own.

```md
:::block-social-icons{shape="circle" align="center"}
::block-social-link{network="github" url="https://github.com/plutocms"}
::

::block-social-link{network="email" url="mailto:hello@example.com" label="Write to us"}
::
:::
```

### block-gallery (media)

A grid of images. Slot `default` (blocks): `block-image`.

- `columns`: 1 to 6 [3] (two on a screen narrower than 640 px). `gap`: scale [`sm`].
- `ratio`: `auto` [default], `1:1`, `4:3`, `3:2`, `16:9`. The images crop to the ratio.

```md
:::block-gallery{columns="4" ratio="1:1"}
::block-image{src="/media/1.jpg" alt="Front of the shop"}
::

::block-image{src="/media/2.jpg" alt="The kitchen"}
::
:::
```

## Block definitions

- Every definition has a `label`, a `description`, an `icon` (`i-lucide-*`) and a `group`. The prop
  descriptions are in the macro, not in JSDoc.
- The order of a `select` that the macro does not pin follows the TypeScript checker, which is not
  always the order of the source. Pin `options` in the macro when the order matters (`variant`,
  `size`, `valign`...).
- The numbers and booleans of the Markdown are text: `usePlutoBlocksRender().coerce` converts them
  by the type of the definition. A component still reads them with `Number()` and a test, because a
  consumer of the public API gets text.
- An item block (`block-accordion-item`...) is in the palette too: the palette of a slot with
  `accepts` lists only the visible blocks of the accepted names, so an item must not be `hidden`.
- A template does not call an auto-imported util. A `<script setup>` ref is unwrapped in the template
  (`group?.value` is `undefined` there). Compute in the script.

## Tests

- `test/theme.test.ts`: the theme to CSS (the variables, the empty theme, the values that are
  dropped) and every function of `blocks-style.ts`.
- `test/definitions.test.ts`: reads the 22 components with the real parser of core
  (`BlockCatalog`), resolves each with `resolveBlockDefinition`, and checks the labels, the icons,
  the groups, the prop types, the options, the `accepts` and the defaults.
- `test/render.test.ts`: parses `playground/content/pages/landing.md` with `parsePlutoBlocks`,
  converts the props with the definitions, renders it with `MarkdownDocument` on the server, and
  checks the HTML: a section with columns, `h1` and `h2`, the button links, the accordion, a column in
  a column, the `alt` of every image, and the safety of the props.
- `test/setup.ts` gives the auto-imports (`computed`, `definePlutoBlock`, the utils...) as globals.

## Not in this version

- Per-breakpoint overrides (only the `stack` of the columns).
- A dark color for each theme color (set a color that works in both modes, or the variables under
  `.dark`).
- A counter that animates, a carousel, tabs, a form (`@plutocms/forms` is separate).
- The browser check of the layout is manual: the tests check the HTML, not the pixels.
