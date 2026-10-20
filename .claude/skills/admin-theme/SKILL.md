# Admin theme

The admin has its own look, independent of the consumer app's public site: an indigo
primary, zinc neutrals, its own chart palette, surfaces, and the Outfit font.

## Why

The consumer app styles its public site through its own `app.config` colors and `@theme`.
Both used to reach the admin:

- `app.config` `ui.colors` sets Nuxt UI's `--ui-color-*` scales on `:root`. Emi Biscuit set
  `primary: 'emi'`, so every admin primary turned pink.
- `@theme` can redefine a Tailwind color, such as `--color-red-400`, which feeds Nuxt UI's
  `error` color.

## Files

- `app/assets/css/admin-theme.css` — generated. Do not edit it by hand.
- `scripts/generate-admin-theme.cjs` — generates it from the installed Tailwind palette. Run
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

| Role | Color |
|---|---|
| primary | indigo |
| secondary | violet |
| success | green |
| info | blue |
| warning | amber |
| error | red |
| neutral | zinc |

Surfaces (`--pluto-admin-canvas`, `--pluto-admin-sidebar`, `--pluto-admin-navbar`): in light
mode, a white canvas, a zinc-50 sidebar, and a zinc-950 (near black) navbar. The navbar is near
black in both modes. `PlutoNavbarAdmin` sets `data-pluto-admin-dark`, so its text and buttons
take the dark tokens in light mode too. In dark mode the surfaces go from darkest at the top to
lightest in the content:

| Surface | Dark value |
|---|---|
| Navbar (`--pluto-admin-navbar`) | zinc-950, near black |
| Sidebar (`--pluto-admin-sidebar`) | `oklch(17.5% 0.0055 286)`, between zinc-950 and zinc-900 |
| Canvas (`--pluto-admin-canvas`) | zinc-900, a dim dark gray, not pitch black |
| Cards (`--ui-bg`) | `oklch(24% 0.006 286)`, one step above the canvas |

Chart series (`--ui-chart-1` to `-6`): primary, then amber, teal, rose, sky, lime. Light uses
amber-600, teal-600, rose-500, sky-600, lime-700. Dark uses the same, with lime-600. The
dataviz palette checks pass for both: lightness band, chroma floor, colorblind separation,
normal-vision separation, and 3:1 contrast (on white and on the dark card surface). Run the checks again
before you change a slot.

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

## Rules for admin code

- Use Nuxt UI semantic classes (`bg-default`, `text-muted`, `border-default`, `bg-primary`)
  and the surface variables, not raw Tailwind colors such as `bg-zinc-100` or `bg-green-600`.
  Raw colors do not follow the admin theme.
- Call `usePlutoAdminTheme()` in every new admin layout.
- Put `data-pluto-admin-scope` on admin chrome that renders outside an admin layout.

## Limit

`app.config` component themes (for example `ui.button.slots.base`) still merge across layers
and reach the admin. Only colors, tokens, surfaces, and the font are isolated.
