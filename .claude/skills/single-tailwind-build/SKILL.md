# Single Tailwind build

An app that uses Pluto has exactly one Tailwind build. The app's CSS entry owns it. No Pluto
layer registers a Tailwind entry of its own.

## Why

Before this feature, each layer (`pluto`, `ui`, `supabase`, `supabase-shop`, ...) and the app
each had a full Tailwind build. All builds declare the same cascade layers (`theme`, `base`,
`components`, `utilities`). So a utility from a later stylesheet overrides the same-specificity
utility of an earlier one, whatever its media query. On the admin of a consumer app, `.flex-col` and
`.sm:grid-cols-2` from the app's build (last in the page) beat pluto's `.sm:flex-row` and
`.xl:grid-cols-3`. The admin's responsive layout broke.

The admin theme no longer needs a separate build to stay isolated: see the `admin-theme` skill.

## What the app writes

```css
/* app/assets/css/main.css, registered in nuxt.config `css` */
@import 'tailwindcss';
@import '@nuxt/ui';
@import '@plutocms/css';

/* The app's own @theme, @utility, and rules go after these lines, so the app wins. */
```

## Files

- `modules/pluto-css/index.ts` — the Nuxt module (`configKey: 'plutoCss'`, option
  `check`, default `true`). Nuxt registers it automatically, because it is in this layer's
  `modules/` dir.
- `modules/pluto-css/css-entries.ts` — pure helpers, tested in `test/pluto-css.test.ts`.
- `app/assets/css/pluto-layer.css` — this layer's own CSS (the admin theme, `--font-outfit`,
  `--color-admin-*`, `--pluto-admin-bar-height`, `--ui-header-height`).

## The layer CSS convention

A layer may ship `app/assets/css/pluto-layer.css`. Rules:

- Do not import `tailwindcss` or `@nuxt/ui` in it.
- Use only `@theme`, `@custom-variant`, `@utility`, unlayered rules, and imports of plain CSS
  files next to it.
- Add no `@source` for the layer's `app/` dir. Nuxt UI already adds one for every layer.
- Do not register a `css` entry in the layer's `nuxt.config`.

## What the module does

1. It finds the `pluto-layer.css` file of every layer that has one, through
   `getLayerDirectories(nuxt)`.
2. It writes `#build/pluto.css` (`write: true`, so Tailwind can read it from disk). The file
   imports each layer file, base layer first, by a path relative to the build dir. A higher
   layer's `@theme` comes later, so it wins.
   The app imports it as `@plutocms/css`: a Nuxt alias of the file (see [The import names](#the-import-names)).
3. It writes `#build/pluto-site.css`, the opt-in Pluto site theme: one `@import` of core's
   `app/assets/css/pluto-site-theme.css` (`renderPlutoSiteCss`). An app that wants the look of
   the Pluto docs imports it (`@plutocms/css/site`) after `@plutocms/css`. It sets Public Sans and Fredoka
   (`font-display`, the `h1`), the light and dark shades of the app colors, a deep-space dark
   mode, the `heart` selection, the `pluto-sky` background and the `pluto-site-header` offset
   under the admin bar. It does not choose the colors (`app.config` does), and every rule skips
   `data-pluto-admin`. `@plutocms/css` never changes the site, so this file is separate.
4. It reads every `nuxt.options.css` entry and follows its local `@import`s (depth 3).
   - If no entry imports `tailwindcss`, it writes the fallback entry `#build/pluto-entry.css`
     (`@import "tailwindcss"; @import "@nuxt/ui"; @import "@plutocms/css";`) and adds it.
     This keeps a layer repo that runs on its own (`nuxt dev`, `nuxt build` in CI) styled.
     An app with its own entry gets no such file: Tailwind IntelliSense makes a project of every
     CSS file that imports Tailwind, `.nuxt/` too, and could take the fallback for the app's
     design system (it did, and the app's `@theme` colors lost their swatches).
   - Otherwise it warns, once per problem:
     - a layer registers its own Tailwind build;
     - more than one Tailwind build;
     - no entry imports `@plutocms/css` (the generated `#build/pluto.css` counts too);
     - no entry imports `@nuxt/ui` (Nuxt UI styles and the `light:` variant are then
       missing).
   - It does not inject a second build when the app forgot the import. One build is the rule.
5. It prints nothing during `nuxt prepare`.

## The import names

`@plutocms/css` and `@plutocms/css/site` are Nuxt aliases (`nuxt.options.alias`) of
`<buildDir>/pluto.css` and `<buildDir>/pluto-site.css`. They are not npm packages.

- Tailwind's Vite plugin resolves `@import` through the Vite aliases, so the names work in the
  CSS entry. The ESLint Tailwind plugin finds them through the `paths` of the generated
  tsconfig.
- An alias resolves with every package manager. A `style` field in the core package would not:
  under pnpm or Yarn PnP, an app that installs only an outer layer cannot resolve core.
- `/site` is set first. An alias also matches the paths under its name, so `@plutocms/css`
  first would send `@plutocms/css/site` to `pluto.css/site`.
- One import covers every layer: the generated file imports each layer's `pluto-layer.css`.
  A layer has no import name of its own.

## The isolated build (experimental)

`plutoCss: { isolated: true }` (default false) gives the admin a Tailwind build of its own. A site
then needs no Tailwind, and a Tailwind site cannot clash with the admin.

- The module writes `#build/pluto-admin.css` (`tailwindcss`, `@nuxt/ui`, `@plutocms/css`).
  Tailwind compiles it at the app's build, so the Nuxt UI classes of `app.config` are in it.
  Without the flag the file is empty.
- The file is not in `css`. `PlutoAdminTheme` imports it, and only async chunks render that
  component: the admin and auth layouts, and the bar (`LazyPlutoAdminNavbar` in the provider,
  `LazyPlutoNavbarAdminMenu` in `PlutoRoot`). Keep these lazy: a static import from the entry
  puts the admin build in every visitor's page.
- Two build changes keep it off a visitor's page. In `features.inlineStyles`, `PlutoAdminTheme.vue`
  is never inlined: the server HTML links the file, which the browser caches. In the
  `build:manifest` hook, the CSS files of the client chunk with the build get `prefetch: false`
  (Nuxt prefetches the CSS of every async chunk). The Vite plugin finds those files in
  `generateBundle` from the chunk's module ids.
- The Vite plugin `pluto-css:scope-admin` runs `scopeCss` (`modules/pluto-css/scope.ts`) on the
  output. Every rule matches only inside `[data-pluto-admin]` (<html> on an admin page) or
  `[data-pluto-admin-scope]` (the admin bar and its portals): `:root`, `:host`, and `html`
  become those roots, any other selector gets `:is(<root>, <root> *)` on its subject. The scope
  adds (0,1,0), so the admin's utilities win over the app's in the admin, in any order.
- The roots are doubled (`[data-pluto-admin][data-pluto-admin]`, (0,2,0)). On <html> of an admin
  page, the admin's theme variables (Tailwind's and Nuxt UI's, in `@layer theme`) then beat the
  app's `:root` (0,1,0), in any load order. admin-theme.css is not in a layer, so it still beats
  the Nuxt UI defaults of the admin build.
- `PlutoRoot` styles its wrappers with plain CSS (`.pluto-root`, `.pluto-root-page`), not
  Tailwind classes: a site with no Tailwind has none of them.
- The id of the file in a build is a Nuxt virtual id (`virtual:nuxt:…%2Fpluto-admin.css`).
- No fallback entry, and no warning about the app's entry: the app's CSS is its own.
- Measured (2026-11-01): the admin and the bar are right on a site with no Tailwind and on a
  Tailwind site with a clashing theme; the public page gets no reset and no utility; an in-app
  move from the admin to the site leaves the site as it was. Build time: no change. CSS: +4 KB
  gzip on a site with no Tailwind; on a Tailwind site about twice the CSS (the app build still
  has the admin classes, because Nuxt UI adds `@source` for every layer).
- Measured with the build loaded on demand (2026-11-01): a visitor's CSS is 139 B gzip on a site
  with no Tailwind (was 37 KB) and the app's own 29 KB on a Tailwind site (was 62 KB). The admin
  build (38 KB gzip) loads for the admin, for the bar, and in the server HTML when the hint cookie
  renders the bar (styled in the first paint, with no client code).
- Not done: keeping core's admin files out of the app's own build. Tried with `@source not` lines
  for a list of admin-only paths in the app's entry: 29.1 KB to 27.2 KB gzip on a Tailwind site
  (26.5 KB with all of core out, the floor). Core's public components (`PlutoHtml`,
  `PlutoMarkdown`, `PlutoLogo`, `PlutoRoot`) must stay in that build, so the list would need
  upkeep, and a public file on it would lose its styles. Not worth 2 KB.

## Reliance on Nuxt UI

The module adds no `@source`. Nuxt UI's `#build/ui.css` has an `@source "<layer>/app/**/*"`
line for every layer, for local paths and `node_modules` installs alike. If a Nuxt UI upgrade
drops this, admin classes stop being generated. Check `.nuxt/ui.css` after a Nuxt UI upgrade.

## Verify

- In the browser console, count the Tailwind builds:
  `[...document.querySelectorAll('style[data-vite-dev-id]')].filter(s => s.textContent.includes('tailwindcss v4')).length`
  It must be 1, on the admin and on the public site.
- `.nuxt/pluto.css` must list each layer's `pluto-layer.css`.
- The build log must have no `pluto-css` warning.
