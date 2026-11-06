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
  derivation). Real adapters exist: the supabase layer (PostgREST) and the Git CMS (Markdown files) each provide a `PlutoContentAdapter`.
  @.claude/skills/content-model/SKILL.md
- Content type extensions: a layer that does not own a type adds fields to it (`extendContentTypes` on
  the server, the `contentTypeExtensions` bucket on the client). `getContentType`, `listContentTypes`
  and `usePlutoContentTypes()` give the extended type. Core knows nothing of what a layer adds.
  @.claude/skills/content-model/SKILL.md
- Revisions: the optional adapter reads `listRevisions` and `getRevision`, the routes
  `/api/_pluto/content-revisions/<type>/<id>` and `/api/_pluto/content-revision/<type>/<revision>/<id>`
  (the type write capability), and History in the edit form of every type (`PlutoContentHistory`):
  the saved versions, a diff against the form, and a restore that fills the form, so the user saves
  it like any edit. The Git CMS keeps the revisions as commits (GitHub, local Git).
  @.claude/skills/content-model/SKILL.md
- Site composables: `usePosts` and `usePost` (pages and search from the URL, `pageLink`, a 404
  page, the SEO tags, the admin bar edit link, drafts for an editor), `useAdjacentPosts` (newer and
  older), `usePlutoSite` and `usePlutoSiteHead` (the site name, description and title template),
  `formatPublishedDate` (the date of an item, the same text on the server and in the browser),
  `readingMinutes` (the reading time of a body),
  `definePlutoContent` for any public type, and `extendPlutoAsyncData` for a layer's own names.
  The site URL (`websiteUrl`, `NUXT_PUBLIC_WEBSITE_URL`) gives `usePlutoSite().root` and
  `absoluteUrl(path)`, `og:image` is absolute under it, and a server route reads it with
  `getPlutoSiteRoot(event)`. The `contentHead` bucket lets a layer add head tags to every item page.
  The public API serves a draft to an editor (`?drafts=1`) and the neighbors of an item
  (`/api/pluto/v1/surround/<type>/<id>`). @.claude/skills/content-model/SKILL.md
- Public API (headless): a versioned, read-only API for any framework or stack.
  `GET /api/pluto/v1/content/<type>` and `/<type>/<id>` serve the published items of a type that sets
  `api: { public: true }`, with `{ data, meta }` answers, `limit`/`offset`/`search`/`sort`/`filter[field]`,
  an allow-list of fields (`api.fields`), timestamps (`adapter.timestampKeys`), `adapter.toPublic` and
  `hooks.toPublic` (with the batch of the answer), a CDN cache header (`plutoApi.maxAge`), CORS for GET
  (`plutoApi.cors`: any origin, a list, or off) and the composables `usePlutoPublicList` and
  `usePlutoPublicItem`. Internal routes are `/api/_pluto/<area>/...`, and core blocks a cross-site
  write to them for every layer. @.claude/skills/content-model/SKILL.md
- Tags and categories (many-to-many references): a `reference` field with `target` and `multiple` stores
  term ids; the public API expands them to `{ id, label, slug }`, filters by id or slug
  (`filter[tags]=<slug>`) and takes `ids`; the Git CMS registers the `tag` and `category` types
  (capability `terms:manage`), adds the post fields `tags` and `categories`, and rewrites the
  referencing posts in the same commit on a rename or a delete; `useTags`, `useTag`, `useCategories`
  and `useCategory`. Admin: the `reference` widget is a multi-select with inline create (needs the
  write capability of the target), `usePlutoReferenceOptions(target)`, label badges with "+N" in the
  list (`PlutoContentReferenceCell`), and chips in the post preview. @.claude/skills/tags-and-categories/SKILL.md
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
- Content backup: the content form keeps the unsaved changes in `localStorage` (one entry for each
  user, type and item, written 1 s after the last change and when the page hides) and offers to
  restore them when the item opens again: a warning alert with Restore, Discard and Show changes (a diff,
  like History). A save while it is open asks first (Cancel, Restore, Save and discard). A field changed in both places is named. Save, delete and "Leave without saving"
  remove the backup, sign-out removes the backups of the user, and a backup expires after 14 days.
  `form.backup: false` opts a type out, and `onFlush` in the form context lets a widget write
  pending edits first. Same on every backend. A save that fails with a 409 conflict (a stale
  `_version`) writes the backup, shows a warning alert, and "Load the latest and keep my changes"
  loads the stored item and puts the changes on top, naming the fields that changed in both places.
  @.claude/skills/content-backup/SKILL.md
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
- Pluto UI tokens: the official palette (tholin, haze, heart, kuiper) and fonts (Public Sans,
  Fredoka) in `@theme`, for every app. The admin theme is generated from them.
  @.claude/skills/admin-theme/SKILL.md
- Pluto site theme: the opt-in `@import '@plutocms/css/site'` gives a public site the look of the Pluto
  docs (the fonts, the shades of the app colors, a deep-space dark mode, `pluto-sky`,
  `pluto-site-header`). The shop template uses it.
  @.claude/skills/single-tailwind-build/SKILL.md
- White label: `appConfig.pluto.brand` gives the admin the agency brand (logos, primary color,
  radius, fonts, help and agency links, Pluto links off). @.claude/skills/white-label/SKILL.md
- Internationalization (i18n): a custom engine for the admin and the public site. The pluto-i18n
  module merges each layer's `i18n/locales/<code>.json`, `usePlutoI18n()` and
  `usePlutoSiteI18n()` translate and format, a per-user admin language is chosen on the Settings
  page and stored through a registered locale driver. The core admin UI, the registry entries, the
  content-type convention keys (`usePlutoContentText`), the validation codes, and the server errors
  (`createPlutoError`, `usePlutoErrorText`) are translated, in English and Brazilian Portuguese.
  @.claude/skills/i18n/SKILL.md
- Settings pages: `/admin/settings` is a section with tabs. A layer adds a tab with a `settingsPages` entry and a page file at `pages/admin/settings/<x>.vue`. The tabs show with 2 or more pages, the sidebar and the command palette list them, and a tab can need a capability (`'*'` is admin only). The capability picker groups by layer. @.claude/skills/extension-registry/SKILL.md
- Mail: a mail driver contract (`sendPlutoMail`, `registerMailDriver`) with Resend, dev (console and Mailpit) and none drivers, plain-TypeScript email templates (test, invite) translated by a server translator, and a guided `Settings > Email` page (admin only) that checks the key, adds and verifies a domain, and tests the setup. Secrets stay in the environment. @.claude/skills/mail/SKILL.md
- Admin and site CSS: the admin has its own Tailwind build, scoped to the admin and loaded only
  with the admin UI, so a site needs no Tailwind and a site's theme does not reach the admin. A
  Tailwind site owns its one build. The pluto-css module generates `#build/pluto.css` from each
  layer's `pluto-layer.css` (imported as `@plutocms/css` by the admin build and by a Tailwind
  site), and warns about a Tailwind build in a layer or more than one.
  @.claude/skills/single-tailwind-build/SKILL.md
- Public components: the components for a public site (`PlutoHtml`, `PlutoImage`, `PlutoLogo`,
  `PlutoRoot`, `ColorModeButton`, and those of the layers) use only `pluto-*` classes and work with no Tailwind. Their
  look is plain CSS in each layer's `pluto-base.css`, which a site imports with the opt-in
  `@import '@plutocms/css/base'`. @.claude/skills/public-components/SKILL.md
- Git CMS: a standalone CMS with Markdown posts in a Git repo. Out of the box it publishes to the
  local Git repo (dev only: each save is a local commit, `commit.local`); a GitHub App publishes
  from a deployed site. The module is `pluto-github` (config
  `plutoGithub`, env `NUXT_PLUTO_GITHUB_*` and `PLUTO_GITHUB_*`, routes `/api/_pluto/github/*`, names
  `PlutoGithub*` and `usePlutoGithub*`). The public
  `html` and `excerpt` of a Markdown item leave out MDC syntax (`stripMdc`). `plutoGithub.enabled` is
  `'auto'`: on, unless a backend layer is present (the supabase layer, `@nuxtjs/supabase`, or
  `$meta.plutoBackend`). It has defaults for the storage (`fs` in dev), and for the repo (env vars,
  Vercel, the git remote). When on, it has GitHub App sign-in, a sealed
  session, the auth driver for the core admin shell, and the stores, adapter and post type (public on the public API).
  A deployed site bundles the Markdown of its content dir at build time: before the GitHub App or a
  read token exists (a first deploy), the public pages read that snapshot, and then GitHub live.
  Hybrid by default: a save is live at once, a save of published content starts a build that
  refreshes the snapshot (`commit.skipDeploy` is `false` by default), and when GitHub fails the
  public pages serve the snapshot. The post type sets `liveOnSave`. Media commits skip the deploy.
  It also has a Markdown editor with a Visual/Source switch (`PlutoMarkdownSource`, `findUnsafeMarkdown`,
  the `editor` field option), the post editor (`widget: 'post-canvas'`: the canvas layout, an outline
  of the headings, a compose panel with a Visual mode and a Markdown mode (`PlutoMarkdownCodeEditor`,
  CodeMirror with syntax colors), next to a preview of the site at `/_pluto/post-preview` with a
  "Preview" badge, which an app replaces with `components/PlutoPostPreview.vue`; its `item` has the shape of the
  public API, `toPreviewItem`), nested content types
  (`files: { nested, exclude, frontmatter }`, ids that
  are paths, one-commit moves, `listTree` in all stores, `compareContentIds`), no commit for an
  unchanged file, push capabilities for every registered type, the public answer of a Markdown item
  (`excerpt` in a list, `html` for one item, through `adapter.toPublic`), and `PlutoMarkdown` (an alias of the core `PlutoHtml`, which shows the sanitized `html` of any backend). The GitHub App is created from the site (App Manifest flow): the setup routes
  under `/api/_pluto/github/setup/` (`status`, `github/start`, `github/callback`), a result page with the
  env block, a `.env` write in development, a setup check on `/admin/login`, a **GitHub** tab in Settings,
  and a private key in PEM, `\n` or base64 form. With `commit.skipDeploy` off (the default), a draft save gets
  `[skip ci]`, so only a change of published content deploys. The edit form shows the build status of the
  newest commit that did not skip CI (check runs, commit statuses, deployments) next to Save, for GitHub storage with
  `commit.skipDeploy` off: the route `GET /api/_pluto/github/build-status`, a pure reducer, a polling loop,
  and an Info popover with links to the Action or the build. A content type with `liveOnSave` shows
  "Live" at once after a save and the static build as a small spinner. The file adapter has
  `readFile` (safe relative paths) and `_frontmatter` on `get`, and core has the auto-imported
  `markPublicRead(event)` for layers. The backend badge shows local mode or the GitHub repo. In local
  mode it counts the commits that are not pushed and has a Push button (`/api/_pluto/github/local/status`
  and `push`, dev local request only). A read-only **Users** page (`/admin/users`) lists the people
  with write access to the repo (`GET /api/_pluto/github/users`), their GitHub role, what it gives in
  Pluto, and who `ALLOWED_USERS` blocks. A static build (`nuxt generate`, or the `github_pages`
  preset) prerenders the site from the files of the checkout with no token, adds no server route,
  keeps the admin out, and takes a sub path from `PLUTO_BASE_URL` (`PlutoHtml` puts it before the
  site paths of a post body). Any static build, with any backend, also writes a public index
  (`/api/pluto/v1/index.json`), so the list composables search and page in the browser with no
  server (the `pluto-static` module). A **Deploy** tab in Settings (`/admin/settings/deploy`) puts the site
  on a host: import links for Vercel and Netlify, a Node host guide, Cloudflare Pages build settings,
  and GitHub Pages (in local mode it writes and commits the workflow after a dialog, links to the
  Pages settings, and reads the last deploy with the GitHub API; no CLI). Its Domain section links to
  the domain settings of the host (the host is found at build time), and for GitHub Pages gives the
  steps, the DNS records and a DNS check from the server. In local mode, Remove GitHub Pages deletes and
  commits the workflow, then links to the Pages settings to unpublish. @.claude/skills/git-cms/SKILL.md
- Lazy admin components: core registers its field widgets and dashboard widgets with
  `defineAsyncComponent`, shows a skeleton per field, widget and settings panel while a chunk
  loads, and warns in dev about a registered component that is not async.
  @.claude/skills/extension-registry/SKILL.md
- Admin shell: core owns the `/admin` parent route, the `/admin/login` page, the route guard, the admin banners, the navbar and the user menu. A backend layer registers an auth driver, account menu items, site info, link actions and the backend badge of the navbar ("Git · Local", "Git · GitHub", "Database · Supabase", with a popover; `usePlutoBackend`). The auth pages have a language select under the card (this device only; the next sign-in saves it to the user). The admin is for staff only: a signed-in user with no capability goes to `/admin/no-access`. In production, an app with no auth driver (the backend is missing or did not load) sends every admin path to `/admin/not-configured`; in dev the admin opens. The bar shows on `/admin/**` for staff, and on public pages for staff only. A route hides the bar with the page meta `plutoAdminBar: false`, and `isPlutoPreviewPath` marks the preview path. The bar height is the token `--pluto-admin-bar-height`, and `<html>` gets `data-pluto-admin-bar` while the bar shows. A hint cookie puts the bar frame in the server HTML of a public page for staff (the actions and the user menu load after the mount). Content types with `adminBar` get "New <type>" and "Edit <type>" buttons (`usePlutoEditLink`). With two or more types, one "New" menu lists them, grouped by `navGroup`. A `navGroup` also puts related types under one sidebar item (registry bucket `navGroups`, core group `pages`). @.claude/skills/admin-shell/SKILL.md
- Local layers helper: `plutoLayer(name)` from `@plutocms/core/layers` gives a Nuxt `extends` entry.
  With `PLUTO_LOCAL_ROOT`, it uses the local checkouts of the Pluto layers. @.claude/skills/local-layers/SKILL.md
- Pluto logo: `PlutoLogo` draws the logo inline. The wordmark takes the text color, so the logo works
  in light and dark mode. `mark` shows the planet only. The files are `public/img/pluto.svg`,
  `pluto-icon.svg` and `pluto-icon.png` (96 px). The admin navbar and sign-in card use it.
  @.claude/skills/admin-shell/SKILL.md
