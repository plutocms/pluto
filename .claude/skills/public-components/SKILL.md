# Public components

The components that a layer gives a public site work with or without Tailwind. Since the admin
has its own build (see the single-tailwind-build skill), a site gets no Tailwind from Pluto. A
public component that used Tailwind classes would render bare, or break, on a site with no
Tailwind.

## The list

| Component                         | Layer         | Notes                                                                                                                                                                                                                                                                              |
| --------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PlutoRoot`                       | core          | Plain CSS in its `<style>` (`--pluto-admin-bar-height`, `--pluto-page-height`, the wrappers).                                                                                                                                                                                      |
| `PlutoHtml`                       | core          | The `html` of a public item, with the `pluto-prose` class. Under a sub path (`app.baseURL` not `/`), `withBaseInHtml` puts the base before each site path of `src` and `href`. An embed paragraph becomes the player of an embed provider (see the content-model skill, "Embeds"). |
| `PlutoImage`                      | core          | One `<img>` (NuxtImg) with no class. One root (a `v-if` chain, no fragment), so a class of the caller reaches the image.                                                                                                                                                           |
| `PlutoLogo`                       | core          | An SVG with no class.                                                                                                                                                                                                                                                              |
| `PlutoProse`                      | supabase-blog | A rich text value, with the `pluto-prose` class.                                                                                                                                                                                                                                   |
| `Pluto3dViewer`, `Pluto3dPreview` | 3d            | Layout in the component, look in the base file.                                                                                                                                                                                                                                    |

`PlutoMarkdown` is the old Git CMS name of `PlutoHtml`. The docs layer is a full docs site on
Nuxt UI and Nuxt Content: a site that uses it needs Tailwind and Nuxt UI.

`ColorModeButton` (core, unprefixed): one `<button>` with the `pluto-color-mode-button` class and a
`UIcon` (1em). It is in `ClientOnly` with no fallback slot, so before the mount Nuxt renders an
empty `<span>` with the attributes of the caller (the same size). Hidden when the color mode is
forced. The admin navbar uses `PlutoAdminColorModeButton` (a `PlutoNavbarHit`) instead.

Not in the list: the unprefixed core helpers (`Container`, `ScrollArea`, `Modal*`). They use
Tailwind classes with `twMerge`, and they serve the admin.

## Rules for a public component

- Use only `pluto-*` classes in the template. No Tailwind class and no Nuxt UI theme
  (`#build/ui/*`). A test checks each component (`test/public-components-css.test.ts` in core,
  `test/public-css.test.ts` in the 3d layer).
- CSS that the component needs to work (positions, sizes, an animation) goes in its `<style>`. It
  loads with the component, with no import.
- CSS for the look (colors, fonts, spacing, borders) goes in the layer's
  `app/assets/css/pluto-base.css`. A site imports it with `@import '@plutocms/css/base'`. It is
  optional: without it, the component shows the browser defaults and still works.
- Nuxt UI components that need no CSS of their own, such as `UIcon`, are allowed. An icon is 1em
  square, so set its size with `font-size`.

## The CSS rules

Both the `<style>` of a component and `pluto-base.css`:

- Start with `@layer theme, base, components, utilities;`, then put every rule in
  `@layer components`. The statement fixes the order of Tailwind's layers, whichever file loads
  first. On a Tailwind site, the rules join Tailwind's own `components` layer, so a utility on the
  element wins. On a site with no Tailwind, any unlayered rule of the site wins.
- Wrap every selector in `:where()`, for zero specificity: a site's own class always wins. The
  exception is a rule that must win over another component's `:where()` rule
  (`.pluto-3d-preview__fill` over the root of `Pluto3dViewer`).
- Read the Nuxt UI variables with a plain fallback: `var(--ui-text-muted, color-mix(in oklab,
currentColor 65%, transparent))`. A Nuxt UI site gets its own theme, a plain site gets readable
  defaults. Use system colors (`Canvas`, `CanvasText`, `LinkText`) as fallbacks for surfaces.
- `pluto-base.css` has no Tailwind directive (`@import`, `@apply`, `@theme`, `@utility`).

## `.pluto-prose`

In core's `pluto-base.css`. `PlutoHtml` and the blog's `PlutoProse` use it. It follows the base
of the Nuxt UI editor theme (the look of the blog editor), plus tables and task lists. A site
can set these variables on `.pluto-prose` or an ancestor: `--pluto-prose-heading`,
`--pluto-prose-muted`, `--pluto-prose-link`, `--pluto-prose-border`,
`--pluto-prose-border-accented`, `--pluto-prose-code-bg`, `--pluto-prose-th-bg`,
`--pluto-prose-radius`, `--pluto-prose-mono`.

## The admin

The admin build imports `@plutocms/css/base`, scoped like the rest of the build. The admin shows
public components too: the post preview of core (`PlutoHtml`), the 3D preview of a media file.

## Verify

- A site with no Tailwind and no base import: the 3D viewer fills its box and turns; the prose has
  browser defaults.
- The same site with `@import '@plutocms/css/base'` in a plain CSS entry: the prose has headings,
  code blocks, tables; the 3D badges are pills.
- A Tailwind site with the import: the prose follows the Nuxt UI theme of the site (colors, dark
  mode), and a utility on the component wins over the base.
