# White label

The developer gives the admin the brand of the agency or the product in code, in `app.config.ts`
under `pluto.brand`. The client then sees that brand, not Pluto. There is no settings page: the
brand is part of the site code, reviewed in Git (the roadmap principle "the developer decides, the
client edits").

## Files

- `shared/types/brand.ts` — `PlutoBrand`, and the `AppConfig` / `AppConfigInput` augmentation for
  `pluto.brand`.
- `shared/utils/brand.ts` — pure helpers: `plutoBrandScale(hex)`, `plutoBrandCss(brand)`,
  `plutoBrandContrast(hex)`, `isPlutoBrandHex(value)`, `PLUTO_BRAND_STEPS`. The names have the
  `pluto` prefix: `shared/utils` is auto-imported into every app.
- `app/composables/pluto-brand.ts` — `usePlutoBrand()`: `brand`, `plutoLinks`, `css`.
- `app/components/Pluto/PlutoRoot.vue` — adds the brand CSS to the head (`key: 'pluto-brand'`),
  warns in development about a bad primary, and uses `brand.name` as the last fallback of the
  tab title.
- `PlutoAdminNavbar.vue`, `PlutoAdminAuthCard.vue`, `PlutoAdminUserMenu.vue` — the logos and links.
- Tests: `test/brand.test.ts`.

## Fields

| Field | Effect |
|---|---|
| `name` | Alt text of the logos; the label of the `url` item; the tab title fallback (after the site name). |
| `logo` | The logo on a light background: the sign-in card in light mode. |
| `logoDark` | The logo on a dark background: the navbar (dark in both modes) and the sign-in card in dark mode. |
| `mark` | The small logo in the navbar below `sm`. Default `logoDark`, then `logo`. |
| `url` | A user menu item that opens the agency site. |
| `helpUrl` | A "Help" item (`pluto.navbar.help`) in the user menu. |
| `primary` | A hex color. Core makes the 11-step primary scale from it. |
| `radius` | The admin `--ui-radius`, in rem (default 0.25). |
| `font`, `fontDisplay` | The admin text font and page title font (`font-family` values). The app loads the fonts. `fontDisplay` defaults to `font`, then Fredoka. |
| `plutoLinks` | `false` hides "Pluto on GitHub" in the user menu. |

With a logo, the navbar and the sign-in card show `<img>` elements (`object-contain`, at most
10rem wide in the navbar, 12rem on the card) instead of `PlutoLogo`. With no logo they keep the
Pluto logo, so a brand can change only the colors.

## The primary scale

`plutoBrandScale(hex)` keeps the brand color as step 600 exactly, because light mode uses
`--ui-primary: var(--ui-color-primary-600)`: the primary button is the brand color. Dark mode uses
step 400. The other steps keep the lightness distances of a Tailwind scale toward 50 (L 0.971) and
950 (L 0.258), with less chroma at both ends. The values are OKLCH literals; the browser maps an
out-of-gamut value into sRGB.

A light brand color (yellow, light green) gives white text below 4.5:1 on the primary button.
`PlutoRoot` warns in development with the ratio. A value that is not a hex is ignored, with a
warning. A color name (`emerald`) is not accepted on purpose: the brand CSS is an inline style,
not part of the Tailwind build, so Tailwind may not emit the `--color-emerald-*` variables.

Chart slot 1 reads the primary scale (`--ui-color-primary-600`, dark `-500`), so the brand
recolors it. The other chart slots and the status colors stay as validated.

## The CSS

`plutoBrandCss(brand)` returns one rule, or an empty string when the brand sets no style field. The
selector is the two admin selectors twice:
`:root[data-pluto-admin][data-pluto-admin], [data-pluto-admin-scope][data-pluto-admin-scope]`. The
higher specificity wins over `admin-theme.css` and the radius rule in `pluto-layer.css` in any load
order. The rule sets the primary scale only: the semantic tokens (`--ui-primary` and the dark
step) are `var()` references to the scale on the same element, so they follow. The same holds for
the `--radius-*` tokens, which are `calc()` of `--ui-radius`.
