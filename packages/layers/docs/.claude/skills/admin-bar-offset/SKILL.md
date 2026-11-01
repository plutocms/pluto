# Admin bar offset

The Pluto admin bar shows on public pages for signed-in staff. It is `position: fixed`, 40px high
(`--pluto-admin-bar-height: 2.5rem`), and it has `z-50`. A Nuxt UI site has a sticky `UHeader`
that is `z-50` too. This layer moves the page, the header and the sticky parts under the bar.

Pluto core sets `data-pluto-admin-bar="true"` on `<html>` while the bar shows. It is client
only, like the bar. The admin pages have `data-pluto-admin` on `<html>`, and the rules here never
apply to them.

## Files

- `app/assets/css/pluto-layer.css` — the rules. It is not a Tailwind entry: it imports no
  Tailwind and adds no `@theme` and no `@source`. The app reads it through `@plutocms/css`.

## The rules

1. `:root:not([data-pluto-admin])` sets `--pluto-site-header-height: 4rem`. A site with another
   header height sets this variable.
2. With the bar, `--ui-header-height` is the site header height plus the bar height. Nuxt UI
   reads `--ui-header-height` for the page aside (`UPageAside`), the table of contents
   (`UContentToc`), the mobile menu and the anchor scroll margin. They stick under the bar and the
   header.
3. With the bar, `body` gets `padding-top` of the bar height. Without it the first 40px of the page
   would sit under the bar.
4. The class `pluto-header-offset` on `UHeader` sets `top: var(--pluto-admin-bar-height)` and keeps
   the header height at `--pluto-site-header-height`. Without this class, `UHeader` would grow to
   the new `--ui-header-height`.

## In the app

- The CSS entry of the app sets `:root:not([data-pluto-admin]) { --ui-header-height: 4rem }`, after
  `@import '@plutocms/css'`. Pluto sets `--ui-header-height: 2.5rem` for the admin.
- The header gets the class: `<AppHeader class="pluto-header-offset" />`. If the app lints
  Tailwind class names, add `pluto-header-offset` to the ignore list of the rule.

## Limits

- The mobile menu header of `UHeader` also uses `--ui-header-height`. With the bar it is the bar
  height taller than the site header. Check it in a browser.
- The bar appears after hydration, so the page moves down by 40px once for staff.
