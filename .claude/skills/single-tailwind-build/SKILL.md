# Tailwind builds: one for the admin, one for the site

An app that uses Pluto has at most two Tailwind builds:

- The admin build. Core compiles it at the app's build and scopes it to the admin. It styles the
  admin pages, the admin bar, and their overlays. The app does nothing for it.
- The site build: the app's own CSS entry, if the app has one. A site needs no Tailwind.

No Pluto layer registers a Tailwind entry of its own.

## Why

- One shared build (the old setup) forced Tailwind and its reset on every site, and a site's
  `@theme` (spacing, fonts, radius) reached the admin.
- Two unscoped builds in one page break each other. All builds declare the same cascade layers
  (`theme`, `base`, `components`, `utilities`), so a utility from a later stylesheet overrides the
  same-specificity utility of an earlier one, whatever its media query. Before the single build,
  `.flex-col` from the app's build beat pluto's `.sm:flex-row` on the admin. The admin build is
  scoped, so it does not clash with the site build (see "The scope").

## What a Tailwind site writes

```css
/* app/assets/css/main.css, registered in nuxt.config `css` */
@import 'tailwindcss';
@import '@nuxt/ui'; /* when the site uses Nuxt UI */
@import '@plutocms/css'; /* the Pluto tokens and the layers' tokens, optional */

/* The app's own @theme, @utility, and rules go after these lines. */
```

A site with no Tailwind writes nothing. Core's public components that use Tailwind classes
(`PlutoHtml`, the blog layer's `PlutoProse`, the 3D viewer) need the site build.

## Files

- `modules/pluto-css/index.ts`: the Nuxt module (`configKey: 'plutoCss'`, option `check`,
  default `true`). Nuxt registers it automatically, because it is in this layer's `modules/` dir.
- `modules/pluto-css/css-entries.ts`: pure helpers, tested in `test/pluto-css.test.ts`.
- `modules/pluto-css/scope.ts`: `scopeCss`, tested in `test/pluto-css-scope.test.ts`.
- `app/components/Pluto/Admin/PlutoAdminTheme.vue`: imports the admin build.
- `app/components/Pluto/PlutoRoot.vue`: plain CSS that every page needs
  (`--pluto-admin-bar-height`, the root wrappers).
- `app/assets/css/pluto-layer.css`: this layer's own CSS (the tokens, the admin theme,
  `--font-outfit`, `--color-admin-*`, `--ui-header-height`).

## The layer CSS convention

A layer may ship `app/assets/css/pluto-layer.css`. Two builds import it, through
`@plutocms/css`: the admin build, and the site build of a Tailwind site. Rules:

- Do not import `tailwindcss` or `@nuxt/ui` in it.
- Use only `@theme`, `@custom-variant`, `@utility`, unlayered rules, and imports of plain CSS
  files next to it.
- Add no `@source` for the layer's `app/` dir. Nuxt UI already adds one for every layer.
- Do not register a `css` entry in the layer's `nuxt.config`.
- A value that a site with no Tailwind needs goes in plain CSS (PlutoRoot), not here: in the
  admin build, a `:root` rule of this file only applies in the admin.

## What the module does

1. It finds the `pluto-layer.css` file of every layer that has one, through
   `getLayerDirectories(nuxt)`.
2. It writes `#build/pluto.css` (`write: true`, so Tailwind can read it from disk). The file
   imports each layer file, base layer first, by a path relative to the build dir. A higher
   layer's `@theme` comes later, so it wins. Its import name is `@plutocms/css`.
3. It writes `#build/pluto-site.css`, the opt-in Pluto site theme: one `@import` of core's
   `app/assets/css/pluto-site-theme.css`. A site that wants the look of the Pluto docs imports it
   (`@plutocms/css/site`) after `@plutocms/css`. It sets Public Sans and Fredoka (`font-display`,
   the `h1`), the light and dark shades of the app colors, a deep-space dark mode, the `heart`
   selection, the `pluto-sky` background and the `pluto-site-header` offset under the admin bar.
   It does not choose the colors (`app.config` does), and every rule skips `data-pluto-admin`.
4. It adds the admin build (see "The admin build").
5. It reads every `nuxt.options.css` entry, follows its local `@import`s (depth 3), and warns
   when a layer registers its own Tailwind build, or when the app has more than one. It prints
   nothing during `nuxt prepare`.

There is no fallback entry: an app with no Tailwind entry gets no Tailwind on its site.

## The admin build

- `#build/pluto-admin.css` imports `tailwindcss`, `@nuxt/ui`, and `@plutocms/css`. Tailwind
  compiles it at the app's build, so the Nuxt UI classes of `app.config` are in it.
- It is not written to disk. On disk, it would be a Tailwind entry in `.nuxt/`, and Tailwind
  IntelliSense makes a project of every such file and can take it for the app's design system (it
  did with the old fallback entry, and the app's `@theme` colors lost their swatches). Vite reads
  it as a Nuxt virtual module (`virtual:nuxt:…%2Fpluto-admin.css`).
- It is not in `css`. `PlutoAdminTheme` imports it, and only async chunks render that component:
  the admin and auth layouts, and the bar (`LazyPlutoAdminNavbar` in the provider,
  `LazyPlutoNavbarAdminMenu` in `PlutoRoot`). Keep these lazy: a static import from the entry
  puts the admin build in every visitor's page.
- Two build changes keep it off a visitor's page. In `features.inlineStyles`, `PlutoAdminTheme.vue`
  is never inlined: the server HTML links the file, which the browser caches. In the
  `build:manifest` hook, the CSS files of the client chunk with the build get `prefetch: false`
  (Nuxt prefetches the CSS of every async chunk). The Vite plugin finds those files in
  `generateBundle` from the chunk's module ids.

## The scope

The Vite plugin `pluto-css:scope-admin` runs `scopeCss` on the compiled admin build:

- Every rule matches only inside `[data-pluto-admin]` (<html> on an admin page) or
  `[data-pluto-admin-scope]` (the admin bar and its portals).
- `:root`, `:host`, and `html` become those roots, doubled (`[data-pluto-admin][data-pluto-admin]`,
  (0,2,0)). On <html> of an admin page, the admin's theme variables (Tailwind's and Nuxt UI's, in
  `@layer theme`) then beat the site's `:root` (0,1,0), in any load order. admin-theme.css is not
  in a layer, so it still beats the Nuxt UI defaults of the admin build.
- Any other selector gets `:is(<root>, <root> *)` on its subject, before a pseudo-element. The
  scope adds (0,1,0), so the admin's utilities win over the site's same-named utilities in the
  admin, in any order.
- A selector that names a root stays. Rules nested in rules, and `@keyframes`, stay.

## Measured (2026-11-01)

- A site with no Tailwind: a visitor's CSS is the site's own (139 B gzip in the test app). The
  public page gets no reset and no utility.
- A Tailwind site with a clashing `@theme`: a visitor gets the site build only (29 KB gzip). The
  admin keeps its theme, the site keeps its own.
- The admin build (38 KB gzip) loads for the admin, for the bar, and in the server HTML when the
  hint cookie renders the bar (styled in the first paint, with no client code).
- Build time: no change.
- Not done: keeping core's admin files out of the site build. Tried with `@source not` lines for a
  list of admin-only paths: 29.1 KB to 27.2 KB gzip (26.5 KB with all of core out, the floor).
  Core's public components must stay in that build, so the list would need upkeep, and a public
  file on it would lose its styles. Not worth 2 KB.

## The import names

`@plutocms/css` and `@plutocms/css/site` are Nuxt aliases (`nuxt.options.alias`) of
`<buildDir>/pluto.css` and `<buildDir>/pluto-site.css`. They are not npm packages.

- Tailwind's Vite plugin resolves `@import` through the Vite aliases, so the names work in a CSS
  entry. The ESLint Tailwind plugin finds them through the `paths` of the generated tsconfig.
- An alias resolves with every package manager. A `style` field in the core package would not:
  under Yarn PnP, an app that installs only an outer layer cannot resolve core.
- `/site` is set first. An alias also matches the paths under its name, so `@plutocms/css`
  first would send `@plutocms/css/site` to `pluto.css/site`.
- One import covers every layer: the generated file imports each layer's `pluto-layer.css`.
  A layer has no import name of its own.

## Reliance on Nuxt UI

The module adds no `@source`. Nuxt UI's `#build/ui.css` has an `@source "<layer>/app/**/*"`
line for every layer, for local paths and `node_modules` installs alike. If a Nuxt UI upgrade
drops this, admin classes stop being generated. Check `.nuxt/ui.css` after a Nuxt UI upgrade.

## Verify

- On a public page, as a visitor: no `PlutoAdminTheme*.css` in the network panel or as a
  `<link rel="prefetch">`.
- On an admin page: the admin keeps its look when the site has a clashing `@theme`.
- `.nuxt/pluto.css` must list each layer's `pluto-layer.css`.
- The build log must have no `pluto-css` warning.
