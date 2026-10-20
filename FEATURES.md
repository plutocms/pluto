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
- Dashboard: the admin home with a date and title header, a create menu, and core widgets:
  content tiles (total, +N this week, published/draft meter), a `UChart` weekly activity
  chart backed by the optional adapter `countCreated`, and quick actions.
  @.claude/skills/dashboard/SKILL.md
- Admin theme: the admin keeps its own palette, chart colors, surfaces, and font under
  `data-pluto-admin`, so the consumer app's site theme does not reach it.
  @.claude/skills/admin-theme/SKILL.md
- Internationalization (i18n): a custom engine for the admin and the public site. The pluto-i18n
  module merges each layer's `i18n/locales/<code>.json`, `usePlutoI18n()` and
  `usePlutoSiteI18n()` translate and format, a per-user admin language is chosen on the Settings
  page and stored through a registered locale driver. The core admin UI, the registry entries, the
  content-type convention keys (`usePlutoContentText`), the validation codes, and the server errors
  (`createPlutoError`, `usePlutoErrorText`) are translated, in English and Brazilian Portuguese.
  @.claude/skills/i18n/SKILL.md
- Single Tailwind build: the app owns the only Tailwind build. The pluto-css module generates
  `#build/pluto.css` from each layer's `pluto-layer.css`, adds a fallback entry, and warns
  about a wrong CSS setup. @.claude/skills/single-tailwind-build/SKILL.md
- GitHub CMS (in progress): an optional standalone CMS with Markdown posts in a GitHub repo. It is off
  by default and refuses to run with the supabase layer. Only the `pluto-cms` module skeleton and
  its option resolver exist so far. @.claude/skills/github-cms/SKILL.md
