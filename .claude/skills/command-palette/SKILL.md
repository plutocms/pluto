# Command palette

This feature gives the admin area a command palette. Press Cmd+K (macOS) or Ctrl+K (other
systems), or click the search button at the top of the sidebar. Type to filter. Press Enter to
run the selected command.

## Files

- `app/composables/pluto-command-palette.ts` — `usePlutoCommandPalette()`. It returns the
  palette groups as a computed ref.
- `app/layouts/admin.vue` — mounts Nuxt UI's `UDashboardSearch` with those groups, and a
  `UDashboardSearchButton` in the `UDashboardSidebar` header.
- `test/command-palette.test.ts` — unit tests for the composable.

## Groups

The palette shows these groups, in this order. An empty group does not show.

1. **Create** — one "New <label>" command for each registered content type. The command opens
   the content type's `newPath`. If `newPath` is not set, it opens `<basePath>/new`. If
   `basePath` is not set, it opens `/admin/content/<name>/new`. The command shows only if the
   user has the content type's `capabilities.write`. A content type with no `write` capability
   is open to every admin, the same rule as `PlutoContentForm`.
2. **Go to** — every admin nav item and nav child from `usePlutoAdminNav()`. A child shows its
   parent label as a suffix and its parent icon.
3. **Theme** — System, Light, and Dark. `UDashboardSearch` adds this group itself.

The group labels ("Create", "Go to"), the search placeholder, and every command label are
translated. A "New <label>" command uses `usePlutoContentText`. A nav label resolves with `tx()`.
A language switch updates the palette. See the i18n skill.

Each destination shows once. The Create group is built first, so a nav link to a create path
(for example "Create new post") does not show again in Go to. A nav child with the same path as
its parent shows once, as the parent. The Settings item has one child per visible settings page
(2 or more pages), so each tab is a "Go to" command with the suffix "Settings". The General tab
points at the Settings path, so it shows once, as "Settings".

A layer adds to the palette through the normal extension points. A new content type adds a
Create command. A new nav item adds a Go to command.

## Rules

- Navigate with `navigateTo` in each command's `onSelect`. Do not set `to`. `to` is typed per
  app through typed pages, so its type differs in every app that extends this layer. The
  sidebar menu in `admin.vue` uses the same approach.
- Keep `UDashboardSearch` and `UDashboardSearchButton` inside `UDashboardGroup`. The button
  gets its toggle from the dashboard context. Outside the group, the button has no context and
  its click does nothing. The keyboard shortcut still works, because `UDashboardSearch`
  registers it itself.
- The palette opens through Nuxt UI's global `dashboard:search:toggle` hook. Mount only one
  `UDashboardSearch` in the app.
