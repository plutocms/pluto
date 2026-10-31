# Admin bar actions: "New page" and "Edit page"

Status: done
Started: 2026-10-25
Projects: nuxt-content (0.3.0), plutocms (docs site)
Branch / PR: #9, release #10 (0.3.0)

## Context

- User (2026-10-25): add admin actions for the Nuxt Content layer, such as Create Page and Edit
  Page. Like the WordPress admin bar: "+ New" everywhere, "Edit page" on the public page.
- Core has the `navbarActions` registry bucket. A link action cannot hide itself, so the layer
  registers one component action that renders `PlutoNavbarButton` items (each is an `<li>`).
- "Edit page" needs the content id of the page on screen. The layer does not own the
  collections (the app does), so a route cannot map to a stem in the layer. The page tells the
  layer: `usePlutoContentEditLink(page, type)` (already in every docs page) also records the
  current page for the bar, client only, and clears it when the page unmounts (a token guard,
  because the next page can mount before the old one unmounts).
- Rules: the buttons show only with `docs:write` (`can()`, fails open with no driver). "New"
  shows on every page where the bar shows, one button per type ("New Page", from
  `usePlutoContentTexts().newLabel`). "Edit page" shows on a public page with a recorded page,
  not on `/admin/**` (the form has "View page").
- `contentEditPath(type, id)` in `shared/utils/content-route.ts`, used by the composable and the
  bar, with tests.

## Checklist

- [x] `contentEditPath` + tests.
- [x] Current page state (`usePlutoContentCurrentPage`), set by `usePlutoContentEditLink`.
- [x] `PlutoNuxtContentBarActions` component action, registered in the plugin.
- [x] i18n: `nuxtContent.actions.edit` ("Edit {label}", like core "New {label}"; en, pt-BR).
- [x] Docs: page-links skill, FEATURES, README; the docs site page for the layer.
- [x] Docs site: landing calls `usePlutoContentEditLink` too; check in Chrome.
- [x] lint/typecheck/test; PR, release 0.3.0 (`feat`); docs site to ^0.3.0.

## Log

- 2026-10-25: plan made.
- 2026-10-25: built. Checked on a test dev server with the local layer: the bar shows "New Page" and
  "Edit Page" on a docs page (`/admin/content/doc/2.core/03.content-model`) and on the landing
  (`/admin/content/doc/index`), and only "New Page" in the admin. lint/typecheck/test pass.
- 2026-10-25: released 0.3.0 (#9, #10). Docs site on ^0.3.0, pushed, CI green.
