# Features

This file lists every implemented feature of this project. Each entry links to a skill file
with full detail, so this file stays short.

See the workspace-level `CLAUDE.md` (one directory up) for the delegation, writing, and git
policies shared by every project here.

- Extension registry: a typed, ordered, reactive registry that lets a layer plug its admin-UI
  pieces (navbar, sidebar nav, pages, dashboard widgets, settings panels and driver) into core
  with one function call. @.claude/skills/extension-registry/SKILL.md
- Permissions: a typed capability registry and a `usePlutoPermissions()` composable that let a
  layer declare capabilities and check what the current user holds, backed by a registered
  permissions driver. @.claude/skills/permissions/SKILL.md
- Content model: a typed content-type contract (`defineContentType`, field types, payload
  validation, field-to-column mapping) and a media-adapter contract, with registry wiring and
  consumer composables, a server-side content registry and generic list/get/create/update/
  delete routes backed by a `PlutoContentAdapter` a backend layer implements, and a generated
  admin UI (list/form components, eight built-in field widgets, generated
  `/admin/content/**` pages, and nav/pages derivation). No real adapter yet.
  @.claude/skills/content-model/SKILL.md
- Admin view chrome: per-view shell components (`PlutoViewAdminPanel`, `PlutoViewToolbar`,
  `PlutoViewAside`), the generic content form's publish workflow, and the `contentActions`
  registry bucket that lets a layer add its own buttons to that form.
  @.claude/skills/admin-view-chrome/SKILL.md
- Command palette: Cmd/Ctrl+K and a sidebar search button open a `UDashboardSearch` with
  "New <type>" commands for writable content types, every admin nav destination, and theme
  commands. @.claude/skills/command-palette/SKILL.md
- Content overview: core's dashboard widget with one stat tile per content type (total, and a
  published/draft meter for types with a status workflow), counted through `limit=1` list
  requests and the list route's `published=1` filter. @.claude/skills/content-overview/SKILL.md
