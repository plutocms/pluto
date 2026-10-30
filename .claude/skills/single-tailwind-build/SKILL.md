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
@import '#build/pluto.css';

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
3. It writes `#build/pluto-site.css`, the opt-in Pluto site theme: one `@import` of core's
   `app/assets/css/pluto-site-theme.css` (`renderPlutoSiteCss`). An app that wants the look of
   the Pluto docs imports it after `#build/pluto.css`. It sets Public Sans and Fredoka
   (`font-display`, the `h1`), the light and dark shades of the app colors, a deep-space dark
   mode, the `heart` selection, the `pluto-sky` background and the `pluto-site-header` offset
   under the admin bar. It does not choose the colors (`app.config` does), and every rule skips
   `data-pluto-admin`. `#build/pluto.css` never changes the site, so this file is separate.
4. It writes `#build/pluto-entry.css`, the fallback entry:
   `@import "tailwindcss"; @import "@nuxt/ui"; @import "./pluto.css";`
5. It reads every `nuxt.options.css` entry and follows its local `@import`s (depth 3).
   - If no entry imports `tailwindcss`, it adds the fallback entry. This keeps a layer repo
     that runs on its own (`nuxt dev`, `nuxt build` in CI) styled.
   - Otherwise it warns, once per problem:
     - a layer registers its own Tailwind build;
     - more than one Tailwind build;
     - no entry imports `#build/pluto.css`;
     - no entry imports `@nuxt/ui` (Nuxt UI styles and the `light:` variant are then
       missing).
   - It does not inject a second build when the app forgot the import. One build is the rule.
6. It prints nothing during `nuxt prepare`.

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
