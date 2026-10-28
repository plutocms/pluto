# Admin theme

The admin has its own look, independent of the consumer app's public site: the Pluto UI tokens
(a tholin primary, haze secondary, kuiper neutrals), its own chart palette, surfaces, and the
Pluto fonts.

## The Pluto UI tokens

`app/assets/css/pluto-tokens.css` holds the official palette and fonts of Pluto in
`@theme static`: the scales `tholin` (red-orange, the action color), `haze` (blue), `heart`
(tan and cream) and `kuiper` (a cool deep neutral), 50 to 950, and `--font-pluto` (Public Sans)
and `--font-pluto-display` (Fredoka). Every app gets the utilities (`bg-tholin-600`,
`font-pluto`) and the variables. The tokens only add names; they never change the app's own
colors or fonts. `pluto-layer.css` imports the file before `admin-theme.css`.

The generator reads the scales from this file, so the admin and the tokens cannot drift. Change a
token, then run the generator.

## Why

The consumer app styles its public site through its own `app.config` colors and `@theme`.
Both used to reach the admin:

- `app.config` `ui.colors` sets Nuxt UI's `--ui-color-*` scales on `:root`. Emi Biscuit set
  `primary: 'emi'`, so every admin primary turned pink.
- `@theme` can redefine a Tailwind color, such as `--color-red-400`, which feeds Nuxt UI's
  `error` color.

## Files

- `app/assets/css/admin-theme.css` — generated. Do not edit it by hand.
- `app/assets/css/pluto-tokens.css` — the Pluto UI tokens (see above).
- `scripts/generate-admin-theme.cjs` — generates it from the Pluto tokens and, for the status
  colors, the installed Tailwind palette. Run
  `node scripts/generate-admin-theme.cjs` from the repo root.
- `app/composables/pluto-admin-theme.ts` — `usePlutoAdminTheme()`.
- `app/layouts/admin.vue`, `app/layouts/auth.vue` — call `usePlutoAdminTheme()`.
- `app/components/Pluto/Navbar/PlutoNavbarAdmin.vue` — carries `data-pluto-admin-scope`.

## How it works

Two selectors carry the theme:

- `:root[data-pluto-admin]`. `usePlutoAdminTheme()` sets `data-pluto-admin` on `<html>` while
  an admin layout is mounted, and `useHead` removes it after. The theme then also covers
  overlays (modals, slideovers, menus, toasts, the command palette) that render at the end of
  `<body>`, outside the layout.
- `[data-pluto-admin-scope]`, for admin chrome that also shows on the public site, such as
  the admin navbar for a logged-in admin.

Every value is a literal OKLCH color, never `var(--color-*)`, which an app can redefine. The
selectors are more specific than Nuxt UI's `:root` and `.dark` rules.

The stylesheet declares the semantic tokens (`--ui-primary`, `--ui-bg`, `--ui-text`, ...)
again, not only the color scales. A custom property inherits as a resolved value. On a
scoped element, the `:root` tokens would still hold the app's colors.

## Palette

| Role | Color | Light step | Dark step |
|---|---|---|---|
| primary | tholin | 600 | 400 |
| secondary | haze | 700 | 400 |
| success | green | 500 | 400 |
| info | haze | 500 | 400 |
| warning | amber | 500 | 400 |
| error | rose | 500 | 400 |
| neutral | kuiper | | |

The light steps of tholin and haze give 4.5:1 on white, as on the docs site. Errors use rose, not
red: tholin is a red-orange (OKLCH hue 37) and red (hue 27) looks like it next to a primary
button. Rose is at hue 17. Every value is an OKLCH literal (the generator converts the hex tokens).

Surfaces (`--pluto-admin-canvas`, `--pluto-admin-sidebar`, `--pluto-admin-navbar`): in light
mode, a white canvas, a kuiper-50 sidebar, and a kuiper-950 (near black navy) navbar. The navbar
is near black in both modes. `PlutoNavbarAdmin` sets `data-pluto-admin-dark`, so its text and
buttons take the dark tokens in light mode too. In dark mode the surfaces go from darkest at the
top to lightest in the content, all on the kuiper hue (273):

| Surface | Dark value |
|---|---|
| Navbar (`--pluto-admin-navbar`) | kuiper-950 |
| Sidebar (`--pluto-admin-sidebar`) | `oklch(20.5% 0.040 273)`, between kuiper-950 and kuiper-900 |
| Canvas (`--pluto-admin-canvas`) | kuiper-900 |
| Cards (`--ui-bg`) | `oklch(28% 0.042 273)`, one step above the canvas |

Chart series (`--ui-chart-1` to `-6`), in a fixed order: tholin, haze, lime, violet, teal,
amber. Light: tholin-600, haze-600, lime-700, violet-500, teal-600, amber-600. Dark: tholin-500
(the primary 400 is too light for the dark band), haze-500, lime-600, violet-500, teal-600,
amber-600. The dataviz palette checks pass for both: lightness band, chroma floor, colorblind
separation of neighbors (worst 12.6), normal-vision separation, and 3:1 contrast, on white and on
the dark card surface. Lime must not sit next to amber: that pair fails the colorblind check.
Amber is also the warning color; no other hue passed in the sixth slot without a status color.
Run the checks again before you change a slot.

## Fonts

The admin text is Public Sans (`--font-sans` under the admin selectors). Page titles (`h1`: the
dashboard, Settings, the sign-in card) use Fredoka, the rounded face of the wordmark, through
`--pluto-admin-font-display`. Both are literals, like the colors. `@nuxt/fonts` finds them in
the stylesheet and serves them.

`pluto-layer.css` still declares `--font-outfit` (the font of the admin before the Pluto tokens)
in `@theme`. Some sites use `font-outfit` for their own text, so it stays until they move.

## Corner radius

The admin radius is one step smaller than before: `--ui-radius: 0.25rem` (it was 0.375rem). So
`rounded-md` is 6px in the admin (it was 9px). It lives in `app/assets/css/pluto-layer.css`, not in
the generated `admin-theme.css`, under the same two selectors as the theme:
`:root[data-pluto-admin]` and `[data-pluto-admin-scope]`. Overlays follow the same way as colors.
An admin overlay on a public page needs a `data-pluto-admin-scope` ancestor (the admin menu
slideover has a wrapper. The user menu uses a portal target).

A custom property that uses `var()` resolves where it is declared. So the rule declares
`--radius-xs` to `--radius-3xl` again, next to `--ui-radius`, with the multipliers of Nuxt UI. Never
put the radius in `@theme`: it would reach the public site of the app.

## Snappy hovers

`pluto-layer.css` gives the color, opacity and `transition` utilities no duration in the admin
(also on the `::before` layer of the menu items), so a hover shows at once. A Nuxt UI button
(`[data-slot=base]` on a `button` or `a`) keeps 75ms. The navbar (`data-pluto-admin-dark`) has no
transition at all. Transforms and keyframe animations are not touched. To keep a transition on
purpose, use the important modifier (`before:duration-150!`), as the resize handles do.

## The search overlay

The admin search (`UDashboardSearch`) gets `ui.modal: 'pluto-admin-search'`. A rule in
`pluto-layer.css` (`[data-slot=overlay]:has(+ .pluto-admin-search)`) makes its overlay darker
(`oklch(13% 0.03 273 / 0.6)`) with a 6px backdrop blur. Other modals keep the Nuxt UI overlay.
The sidebar search button is the `soft` variant (no border).

## Rules for admin code

- Use Nuxt UI semantic classes (`bg-default`, `text-muted`, `border-default`, `bg-primary`)
  and the surface variables, not raw Tailwind colors such as `bg-zinc-100` or `bg-green-600`.
  Raw colors do not follow the admin theme.
- Call `usePlutoAdminTheme()` in every new admin layout.
- Put `data-pluto-admin-scope` on admin chrome that renders outside an admin layout.

## Limit

`app.config` component themes (for example `ui.button.slots.base`) still merge across layers
and reach the admin. Only colors, tokens, surfaces, and the font are isolated.
