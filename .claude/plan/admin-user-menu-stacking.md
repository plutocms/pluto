# Admin user menu renders behind the site navbar

Status: in progress
Started: 2026-10-20
Projects: pluto
Branch / PR: fix/admin-user-menu-stacking

## Context

- Goal: on a public page, the open admin user menu shows above the site's own navbar.
- Why: the user reported it in a consumer app. The menu opens behind the sticky site navbar.
- Cause: `PlutoAdminUserMenu` portals the dropdown into `#pluto-admin-user-menu-portal`. That
  target is inside the admin `<nav>` (`PlutoNavbarAdmin`, `fixed z-50`). A fixed element with a
  z-index makes a stacking context, so the menu cannot rise above the nav's own level. Emi's
  navbar is `sticky z-50` and comes later in the DOM, so it paints over the admin nav and its menu.
- Decisions:
  - Teleport the portal target to `<body>`. The menu then stacks at the root level, after the
    site content. It keeps `data-pluto-admin-scope`, so the theme and the radius stay the same.
    The light/dark look does not change: the target had only the scope attribute before too.
  - Do not raise the z-index of the admin bar. A higher bar would cover the top of the public
    admin slideover (`PlutoNavbarAdminMenu`, `z-50` at the end of `<body>`), and its close button
    is at the top.
- Key files: `app/components/Pluto/Admin/PlutoAdminUserMenu.vue`,
  `app/components/Pluto/Navbar/PlutoNavbarAdmin.vue`, `app/assets/css/admin-theme.css`.
- Open questions: none.

## Checklist

- [x] Move the portal target to `<body>` with `<Teleport>`, client side only.
- [x] Update the comment in the component.
- [x] lint, typecheck, test pass (39 files, 607 tests).
- [x] The user checks the fix in a consumer app (local layer).
- [x] Commit and PR.
- [ ] Merge the PR (the user), then the release PR (`fix:` gives a patch).
- [ ] Bump `@plutocms/pluto` where needed so the consumer apps get it in production.

## Log

- 2026-10-20: found the cause. Next: the fix.
- 2026-10-20: fix made on `fix/admin-user-menu-stacking`, not committed. Checks pass. Next: the
  user checks it in a consumer app, then commit and PR.
- 2026-10-20: the first fix (a `<ClientOnly>` + `<Teleport to="body">` target) failed in Emi with
  "Cannot read properties of null (reading 'emitsOptions')" on open. Reka's portal looks for the
  target with Vue's deferred teleport, after the first render. The ClientOnly target appeared one
  tick later. Second fix: the component makes the target element in `onMounted`, appends it to
  `<body>`, passes the element to `portal`, and removes it in `onUnmounted`. Lint and typecheck
  pass. Next: the user checks it again.
- 2026-10-21: the user confirmed the fix in Emi. Committed and opened a PR. Next: the user merges
  it and the release PR, then Emi gets the new patch.
