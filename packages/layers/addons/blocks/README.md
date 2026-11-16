# @plutocms/blocks

**Docs:** [Blocks](https://pluto.vulmix.dev/docs/layers/blocks)

An add-on layer for [Pluto](https://pluto.vulmix.dev) sites, for every backend (Git CMS or
Supabase): a landing kit of blocks for pages. A page is built from sections, columns and widgets
(headings, text, images, buttons, an accordion and more), in the visual block editor of Pluto, or
written as plain Markdown with components.

- **22 blocks** with the prefix `block-`: `::block-section`, `::block-heading`, `::block-button`...
- **One theme** in `app.config.ts`: colors and fonts become CSS variables, on the server too.
- **Plain CSS with low specificity.** It works with or without Tailwind and Nuxt UI, in light and
  dark mode.
- **Accessible by default:** real `h1` to `h6`, a button that links is an `<a>`, an accordion made
  of `<details>` and `<summary>` (no JavaScript), and images that keep their `alt`.

## Install

```bash
npm install @plutocms/blocks
```

Add it next to the backend layer of your app. It does not bring Pluto: the app or the backend
layer does. It needs `@plutocms/core` 0.72.0 or newer.

```ts [nuxt.config.ts]
export default defineNuxtConfig({
  extends: ['@plutocms/core', '@plutocms/blocks'],
})
```

The layer adds its stylesheet (`blocks.css`) to the app. The page type of the site needs a body
field with `widget: 'blocks'` (the `page` type of Pluto has one). Render the body with
`<PlutoBlocks :value="page.blocks" />`.

## The blocks

| Group   | Blocks                                                                                                                                                                                                                              |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout  | `block-section`, `block-columns`, `block-column`, `block-divider`, `block-spacer`                                                                                                                                                   |
| Text    | `block-heading`, `block-text`                                                                                                                                                                                                       |
| Media   | `block-image`, `block-icon`, `block-video`, `block-gallery`                                                                                                                                                                         |
| Landing | `block-button`, `block-icon-list` (+ `block-icon-list-item`), `block-icon-box`, `block-image-box`, `block-accordion` (+ `block-accordion-item`), `block-testimonial`, `block-counter`, `block-social-icons` (+ `block-social-link`) |

A section holds columns and widgets. Columns hold columns (a row). A column holds widgets, and
more columns, so a layout can nest. In MDC, a block has more colons than the blocks inside it:

```md
:::::block-section{bg="surface" padding="xl"}
::block-heading{level="2" align="center"}
Everything you need
::

::::block-columns{gap="lg"}
:::block-column{width="50"}
::block-icon-box{icon="i-lucide-zap" title="Fast"}
Pages load as plain HTML.
::
:::

:::block-column{width="50"}
::block-button{label="Get started" link="/admin"}
::
:::
::::
:::::
```

Every block, its props and an example are in the skill `.claude/skills/blocks-kit/SKILL.md` of the
Pluto repository.

## Values

- **Spacing, gaps and sizes** take a step of the scale (`none`, `xs`, `sm`, `md`, `lg`, `xl`,
  `2xl`) or a CSS length (`24px`, `3rem`, `60vh`).
- **A color prop** takes a token name (`primary`, `secondary`, `text`, `accent`, `muted`,
  `surface`, `background`) or a CSS color (`#0f766e`, `rgb(0 0 0 / 50%)`).
- **Columns stack** below a breakpoint: `stack="md"` (768 px, the default), `stack="sm"` (640 px)
  or `stack="never"`.
- A value that is not a safe CSS value, and a link that is not `http`, `https`, `mailto`, `tel`, a
  path or an anchor, is ignored.

## Theme

Set the theme in `app.config.ts`:

```ts [app/app.config.ts]
export default defineAppConfig({
  plutoBlocksTheme: {
    colors: {
      primary: '#0f766e',
      secondary: '#64748b',
      text: '#1c1917',
      accent: '#d97706',
      muted: '#78716c',
      surface: '#f5f5f4',
      background: '#fffdf8',
      onPrimary: '#ffffff',
    },
    fonts: {
      heading: '"Fredoka", sans-serif',
      body: 'system-ui, sans-serif',
    },
  },
})
```

The layer writes the theme as one `:root` rule in the head of the page, on the server too, so the
first paint has the colors:

```css
:root {
  --pluto-blocks-color-primary: #0f766e;
  --pluto-blocks-font-heading: 'Fredoka', sans-serif;
}
```

Every field is optional. The defaults read the Nuxt UI variables when the site has Nuxt UI
(`--ui-primary`, `--ui-bg-elevated`...), and fall back to values that work in light and dark mode:
the text color is `currentColor`, the muted and surface colors are `color-mix()` of it, and the
background is transparent. A fixed color of the theme is the same in both modes: set a color that
works in both, or set the variables under `.dark` in the CSS of your site.

You can also set the variables in your own CSS. They are:

| Variable                                                                 | Default                               |
| ------------------------------------------------------------------------ | ------------------------------------- |
| `--pluto-blocks-color-{primary,secondary,accent}`                        | `--ui-primary`, `--ui-secondary`, ... |
| `--pluto-blocks-color-{text,muted,surface,background,on-primary,border}` | `currentColor` based, `--ui-*`        |
| `--pluto-blocks-font-{heading,body}`                                     | the font of the page                  |
| `--pluto-blocks-space-{xs,sm,md,lg,xl,2xl}`                              | `0.5rem` to `8rem`                    |
| `--pluto-blocks-radius-{sm,md,lg,xl,full}`                               | `0.25rem` to `9999px`                 |
| `--pluto-blocks-container`                                               | `72rem`                               |

## Styling

The CSS is in `app/assets/css/blocks.css`, in the `components` cascade layer. Each selector is one
class (`.pluto-blocks-button`) or a `:where()`, so any CSS of your site, and any Tailwind utility,
wins. The values of the props are `data-*` attributes (`data-variant="outline"`) and inline custom
properties, so you can restyle a block with a plain selector.

## Sanitizing

The text of a page goes through the same filter as the rest of the blocks: raw HTML that can run
code is removed. A block never writes the value of a prop as HTML.
