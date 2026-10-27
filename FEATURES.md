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
  `/admin/content/**` pages with catch-all id routes, `contentIdPath`, `listContentTypes`, and nav/pages
  derivation). Real adapters exist: the supabase layer (PostgREST) and the GitHub CMS (Markdown files) each provide a `PlutoContentAdapter`.
  @.claude/skills/content-model/SKILL.md
- Public API (headless): a versioned, read-only API for any framework or stack.
  `GET /api/pluto/v1/content/<type>` and `/<type>/<id>` serve the published items of a type that sets
  `api: { public: true }`, with `{ data, meta }` answers, `limit`/`offset`/`search`/`sort`/`filter[field]`,
  an allow-list of fields (`api.fields`), timestamps (`adapter.timestampKeys`), `adapter.toPublic` and
  `hooks.toPublic` (with the batch of the answer), a CDN cache header (`plutoApi.maxAge`), CORS for GET
  (`plutoApi.cors`: any origin, a list, or off) and the composables `usePlutoPublicList` and
  `usePlutoPublicItem`. Internal routes are `/api/_pluto/<area>/...`, and core blocks a cross-site
  write to them for every layer. @.claude/skills/content-model/SKILL.md
- Admin view chrome: per-view shell components (`PlutoViewAdminPanel`, `PlutoViewToolbar`,
  `PlutoViewAside`), the generic content form's publish workflow, and the `contentActions`
  registry bucket that lets a layer add its own buttons to that form, and the `contentToolbarItems`
  bucket that adds a component (a status) to its toolbar. The form shows the item title
  in the toolbar, a load error state with retry, a create toast, labeled icon buttons with tooltips,
  and the aside fields inline on a narrow screen. A field can set `listFormat` for the generic list.
  Every form layout has one toolbar (title, save state, unsaved-changes dialog, Ctrl/Cmd+S, a View link
  from `previewUrl`), a form context for widgets (`usePlutoContentForm`), and a `canvas` layout with a left
  panel, a right panel with tabs, and `PlutoContentCanvasPanel`.
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
- Settings pages: `/admin/settings` is a section with tabs. A layer adds a tab with a `settingsPages` entry and a page file at `pages/admin/settings/<x>.vue`. The tabs show with 2 or more pages, the sidebar and the command palette list them, and a tab can need a capability (`'*'` is admin only). The capability picker groups by layer. @.claude/skills/extension-registry/SKILL.md
- Mail: a mail driver contract (`sendPlutoMail`, `registerMailDriver`) with Resend, dev (console and Mailpit) and none drivers, plain-TypeScript email templates (test, invite) translated by a server translator, and a guided `Settings > Email` page (admin only) that checks the key, adds and verifies a domain, and tests the setup. Secrets stay in the environment. @.claude/skills/mail/SKILL.md
- Single Tailwind build: the app owns the only Tailwind build. The pluto-css module generates
  `#build/pluto.css` from each layer's `pluto-layer.css`, adds a fallback entry, and warns
  about a wrong CSS setup. @.claude/skills/single-tailwind-build/SKILL.md
- GitHub CMS: a standalone CMS with Markdown posts in a GitHub repo. `plutoCms.enabled` is
  `'auto'`: on, unless a backend layer is present (the supabase layer, `@nuxtjs/supabase`, or
  `$meta.plutoBackend`). It has defaults for the storage (`fs` in dev), and for the repo (env vars,
  Vercel, the git remote). When on, it has GitHub App sign-in, a sealed
  session, the auth driver for the core admin shell, and the stores, adapter and post type (public on the public API).
  It also has a Markdown editor with a Visual/Source switch (`PlutoMarkdownSource`, `findUnsafeMarkdown`,
  the `editor` field option), nested content types (`files: { nested, exclude, frontmatter }`, ids that
  are paths, one-commit moves, `listTree` in all stores, `compareContentIds`), no commit for an
  unchanged file, push capabilities for every registered type, the public answer of a Markdown item
  (`excerpt` in a list, `html` for one item, through `adapter.toPublic`), and `PlutoMarkdown`. The GitHub App is created from the site (App Manifest flow): the setup routes
  under `/api/_pluto/cms/setup/` (`status`, `github/start`, `github/callback`), a result page with the
  env block, a `.env` write in development, a setup check on `/admin/login`, a **GitHub** tab in Settings,
  and a private key in PEM, `\n` or base64 form. The edit form shows the build status of the head
  commit (check runs, commit statuses, deployments) next to Save, for GitHub storage with
  `commit.skipDeploy` off: the route `GET /api/_pluto/cms/build-status`, a pure reducer, a polling loop,
  and an Info popover with links to the Action or the build. A content type with `liveOnSave` shows
  "Live" at once after a save and the static build as a small spinner. The file adapter has
  `readFile` (safe relative paths) and `_frontmatter` on `get`, and core has the auto-imported
  `markPublicRead(event)` for layers. @.claude/skills/github-cms/SKILL.md
- Lazy admin components: core registers its field widgets and dashboard widgets with
  `defineAsyncComponent`, shows a skeleton per field, widget and settings panel while a chunk
  loads, and warns in dev about a registered component that is not async.
  @.claude/skills/extension-registry/SKILL.md
- Admin shell: core owns the `/admin` parent route, the `/admin/login` page, the route guard, the admin banners, the navbar and the user menu. A backend layer registers an auth driver, account menu items, site info and link actions. The admin is for staff only: a signed-in user with no capability goes to `/admin/no-access`. The bar shows on `/admin/**` for staff, and on public pages for staff only. A route hides the bar with the page meta `plutoAdminBar: false`, and `isPlutoPreviewPath` marks the preview path. The bar height is the token `--pluto-admin-bar-height`, and `<html>` gets `data-pluto-admin-bar` while the bar shows. A hint cookie puts the bar frame in the server HTML of a public page for staff (the actions and the user menu load after the mount). Content types with `adminBar` get "New <type>" and "Edit <type>" buttons (`usePlutoEditLink`). @.claude/skills/admin-shell/SKILL.md
- Local layers helper: `plutoLayer(name)` from `@plutocms/pluto/layers` gives a Nuxt `extends` entry.
  With `PLUTO_LOCAL_ROOT`, it uses the local checkouts of the Pluto layers. @.claude/skills/local-layers/SKILL.md
- Pluto logo: `PlutoLogo` draws the logo inline. The wordmark takes the text color, so the logo works
  in light and dark mode. `mark` shows the planet only. The files are `public/img/pluto.svg`,
  `pluto-icon.svg` and `pluto-icon.png` (96 px). The admin navbar and sign-in card use it.
  @.claude/skills/admin-shell/SKILL.md
