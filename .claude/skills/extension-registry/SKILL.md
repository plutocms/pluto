# Extension registry

This feature lets a layer plug its admin-UI pieces into core without editing core's files. A
layer calls one function, `definePlutoExtension`, from a plugin. Core collects every layer's
contribution into one reactive registry, and the admin UI renders from that registry.

It adds:

- `shared/types/registry.ts` — the `PlutoExtension` shape and the type of each registrable
  thing (`PlutoNavItem`, `PlutoNavbarAction`, `PlutoAdminPage`,
  `PlutoDashboardWidget`, `PlutoSettingsPanel`, `PlutoSettingsPage`, `PlutoSettingsDriver`, `PlutoLocaleDriver`,
  `PlutoAuthDriver`, `PlutoAccountMenuItem`, `PlutoAdminBanner`, `PlutoSiteInfo`;
  `PlutoNavbarAction` is a union of `PlutoNavbarComponentAction` and `PlutoNavbarLinkAction`),
  plus `PlutoRegistry`.
- `shared/types/registry.d.ts` — augments `#app`'s `NuxtApp` with an optional `_plutoRegistry`
  field.
- `app/composables/internal/registry-factory.ts` — `createOwnedRegistry()`, the generic,
  owner-keyed store behind every registrable thing. Not auto-imported (see "Why
  `internal/`" below).
- `app/composables/pluto-registry.ts` — `usePlutoRegistry()`, the lazy per-app registry
  container.
- `app/composables/pluto-extension.ts` — `definePlutoExtension(definition)`, the one function a
  layer author calls.
- `app/composables/pluto-navbar.ts` — `usePlutoNavbarActions()`,
  `usePlutoAdminBar()`, `usePlutoAccountMenu()` and `usePlutoSiteInfo()`.
- `app/composables/pluto-admin-nav.ts` — `usePlutoAdminNav()`, the sidebar nav.
- `app/composables/pluto-admin-pages.ts` — `usePlutoAdminPages()`, page metadata.
- `app/composables/pluto-dashboard.ts` — `usePlutoDashboardWidgets()`.
- `app/composables/pluto-settings.ts` — `usePlutoSettingsPanels()`, `usePlutoSettingsPages()` and
  `usePlutoSettings()`.
- `app/plugins/pluto-core-registrations.ts` — core's own Home and Settings nav entries and
  page metadata.
- `app/components/Pluto/PlutoDashboardWidgets.vue` — renders every registered dashboard
  widget on `/admin/home`.
- `app/pages/admin/settings.vue` — the parent of the Settings section: the title, the tabs
  (`settingsPages`), a no-permission alert, and `<NuxtPage />`.
- `app/pages/admin/settings/index.vue` — the General tab. It renders every registered settings
  panel, backed by whichever settings driver is registered.
- `test/registry.test.ts` — unit tests for `createOwnedRegistry`, run under plain Vitest.

## The registrable things

A layer's `definePlutoExtension` call can set any of these. Every field is optional; a layer
sets only what it has.

| Field                 | Type                        | Purpose                                                                                                                                      |
| --------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `navbarActions`       | `PlutoNavbarAction[]`       | Small buttons in the navbar. Each is a component action (`{ component }`) or a link action (`{ label, icon?, to, target? }`). A union type.  |
| `nav`                 | `PlutoNavItem[]`            | Sidebar entries, with optional `children`.                                                                                                   |
| `pages`               | `PlutoAdminPage[]`          | Metadata (title, icon, parent) for a route Nuxt already made from a file.                                                                    |
| `dashboardWidgets`    | `PlutoDashboardWidget[]`    | Cards shown on `/admin/home`.                                                                                                                |
| `settingsPanels`      | `PlutoSettingsPanel[]`      | Forms shown on `/admin/settings`.                                                                                                            |
| `settingsPages`       | `PlutoSettingsPage[]`       | Tabs of the Settings section. See "Settings pages" below.                                                                                    |
| `mailPanels`          | `PlutoMailPanel[]`          | Sections that a layer adds to the Email settings page. See the [mail skill](../mail/SKILL.md).                                               |
| `settingsDriver`      | `PlutoSettingsDriver`       | Load/save functions for settings storage. One layer normally provides it.                                                                    |
| `localeDriver`        | `PlutoLocaleDriver`         | Load/save functions for the current user's admin language. One layer normally provides it.                                                   |
| `authDriver`          | `PlutoAuthDriver`           | The sign-in backend of the admin. The last one wins. See the admin-shell skill.                                                              |
| `accountMenu`         | `PlutoAccountMenuItem[]`    | Extra items in the navbar user menu.                                                                                                         |
| `adminBanners`        | `PlutoAdminBanner[]`        | Banner components for the admin. Registered now, rendered later.                                                                             |
| `contentToolbarItems` | `PlutoContentToolbarItem[]` | Components in the toolbar of the generic content form, before the buttons. See the [admin view chrome](../admin-view-chrome/SKILL.md) skill. |
| `site`                | `PlutoSiteInfo`             | `name()` and `url()` of the public site.                                                                                                     |
| `navGroups`           | `PlutoNavGroup[]`           | Groups of content types in the sidebar and the admin bar. See "Nav groups" below.                                                            |

The registry buckets for the last four are `authDrivers`, `accountMenu`, `adminBanners` and
`siteInfo`. Core renders the navbar from them. See the [admin shell](../admin-shell/SKILL.md).

### Nav groups

A `navGroups` entry is `{ id, label, icon?, order? }`. `label` is a translation key or text. The
registry stores the id as `<extensionId>:<id>`. Core declares one group, `pluto:pages` (label
`pluto.nav.pages`: "Pages" and "Páginas", icon `i-lucide-book-open`, order 100, with the content items).

A content type joins a group with `navGroup` (see the content-model skill). The id of the group
or its bare id (`'pages'`) works. The bare id works when only one group has it.

- Sidebar (`usePlutoAdminNav`): the visible types of a group (the `read` capability) become one item
  with the label and the icon of the group. It has no link of its own. Its children are one link per
  type: the plural label, the icon of the type, the list page. The item is active on the pages of its
  types (the `match` paths hold the new and edit pages). A group with one visible type shows that type
  as a normal item. A type with an unknown group is a normal item too, and dev mode logs one warning.
- Admin bar (`PlutoContentBarActions`): see the admin-shell skill.

The helpers `findNavGroup` and `splitByNavGroup` are in `app/composables/internal/nav-groups.ts`.

### The admin menu on small screens

`usePlutoAdminMenu()` turns the `nav` entries into `UNavigationMenu` items, and
`usePlutoAdminMenuOpen()` holds the open state (the `pluto-admin-sidebar-open` state key). The
navbar's menu button sets that state.

- On `/admin/**`, the admin layout's `UDashboardSidebar` opens.
- On a public page, the admin layout is not there. `PlutoRoot` renders `PlutoNavbarAdminMenu`
  instead: a left `USlideover` with the same menu and the admin theme (`data-pluto-admin-scope`).
- `PlutoRoot` closes the menu after every navigation. The watch is in `PlutoRoot`, because the
  public-page menu unmounts when the route moves into `/admin`.

### Collapse and active items

The admin sidebar is `collapsible` (Nuxt UI): its footer has `UDashboardSidebarCollapse`
(desktop only). Collapsed, it is a 4rem rail: the search button is square, and `UNavigationMenu`
gets `collapsed`, `tooltip` (the item label) and `popover` (the children of a group). Nuxt UI
keeps the state in the `pluto-admin` group cookie.

Only a top-level item shows the active background. Each child item has
`ui.link: 'data-active:before:bg-transparent'`, so an active child shows the primary text alone. A group
item is `active` on every page that belongs to it (`activeNavGroups`: its path, a child path, a
page below one, or a `match` path), not only on its own path.

### Open groups

`usePlutoAdminMenuGroups()` holds the ids of the open groups (the `v-model` of `UNavigationMenu`,
state key `pluto-admin-menu-groups`). The sidebar and the public-page menu share it. Each menu
item has `value: <nav item id>`. After each navigation, the group of the active page opens. A
group with `defaultOpen` opens when it first shows. The user can close any group. It stays closed
until the next navigation into it. The pure rules are in `app/composables/internal/admin-menu.ts`
(`activeNavGroups`, `nextOpenGroups`, `contentTypeMatches`). Tests: `test/admin-menu.test.ts`.

A group is active when the path is (or is below) the item's `to`, a child's `to`, or a path in
the item's `match`. `usePlutoAdminNav` adds to `match` the new page and the edit pages of each
content type whose `basePath` is the item's `to`. So `/admin/product/edit/7` opens the Products
item at `/admin/products` without a `match` in the layer.

Every entry (`PlutoNavItem`, `PlutoDashboardWidget`, and so on) extends `PlutoEntry`:

- `id` — unique inside the extension. Core stores it as `"<extensionId>:<id>"`, so two layers
  can each use the id `home` without a clash.
- `order` — lower comes first. Default 100. Core reserves `0` for Home and `1000` for Settings,
  so a normal layer's items sort between them without setting `order` at all.
- `enabled` — an optional function called inside a `computed`. Return `false` to hide the entry.
  Because it runs inside the registry's own reactive computation, a value it reads (for example
  a feature flag ref) changing later shows or hides the entry automatically.

## Text in an entry: key or literal

Every user-visible string in an entry (`label`, `title`, `description`, and so on) is a plain
`string`. It can be an English literal, or a translation key such as `supabase-blog.nav.posts`.
The component that renders the entry passes the string through `tx()` from `usePlutoI18n()`.
`tx()` translates the value only when it looks like a key and the key exists. Any other value
comes back unchanged. So an existing layer with English literals keeps working, and a layer can
move to keys one entry at a time. See the i18n skill.

Core's own registrations (`app/plugins/pluto-core-registrations.ts`) use keys, for example
`pluto.nav.home` and `pluto.dashboard.activity.title`. The consumer composables resolve every
entry text inside a `computed`: `usePlutoAdminNav`, `usePlutoCommandPalette`, `usePlutoSettingsPanels`, `usePlutoDashboardWidgets`,
`usePlutoAdminPages`, `usePlutoContentActions`, and `usePlutoCapabilities`. A language switch
updates them. A registry field stays a `string`.

## The locale driver

`localeDriver` is a `PlutoLocaleDriver`: `load(): Promise<string | null>` returns the stored
locale code, or `null` for Automatic (browser language). `save(locale: string | null)` stores the
choice. It follows the settings-driver pattern: the last registered driver wins. A backend layer
(for example `@plutocms/supabase`) registers it. Core calls `load` from
`usePlutoI18n().syncUserLocale()`, and `save` from `usePlutoI18n().setLocale()`. With no driver,
the choice lives in the `pluto-admin-locale` cookie only.

## Ordering and dedupe

Each registrable thing has its own `createOwnedRegistry()` store, keyed by extension id, not
by entry id. This gives two guarantees:

1. **Owner-replacement, not append.** Calling `definePlutoExtension` again with the same `id`
   replaces that extension's whole contribution to every bucket. Re-running a plugin (for
   example on Vite HMR) never duplicates entries, and needs no warning or manual cleanup.
2. **Stable order.** The merged list across every extension sorts by `order` first, then by
   registration sequence for ties. The sequence counter only grows — it is not reset by a
   `set` call — so a tie always keeps its original relative order across HMR reloads.

## How a layer plugs in

Call `definePlutoExtension` from a plugin, once, with everything that layer contributes:

```ts
// app/plugins/pluto-registrations.ts
export default defineNuxtPlugin(() => {
  definePlutoExtension({
    id: 'supabase-blog',
    nav: [
      {
        id: 'posts',
        label: 'Posts',
        icon: 'lucide:file-text',
        to: '/admin/posts',
      },
    ],
    pages: [
      {
        id: 'posts',
        path: '/admin/posts',
        title: 'Posts',
        icon: 'lucide:file-text',
      },
    ],
    dashboardWidgets: [
      { id: 'recent-posts', component: RecentPostsWidget, colSpan: 2 },
    ],
  })
})
```

Use the package's `$meta.name` (for example `'supabase-blog'`) as the extension `id`. This
keeps ids stable across a monorepo and matches how core discovers layer names elsewhere.

## Settings pages

`/admin/settings` is a section with tabs. `app/pages/admin/settings.vue` is the parent route.
General (`pages/admin/settings/index.vue`) is the first tab. It shows the language card and
the `settingsPanels`. A layer adds a tab in two steps:

1. Ship a page file at `app/pages/admin/settings/<x>.vue` (the route contract).
2. Register a `settingsPages` entry: `{ id, order, label, icon?, to: '/admin/settings/<x>', capability? }`.
   `label` is key-or-literal. `capability` is a capability key. `'*'` means admin only. With no
   capability, every user in the admin sees the tab. Core registers `general` with order 0.

`usePlutoSettingsPages()` returns `all` (every enabled page), `items` (the pages the user may
see, sorted by `order`), `current` (the page of the route, by the longest `to` prefix) and
`allowed` (false when the current page needs a capability the user lacks). The parent page shows
the tabs with 2 or more visible pages. When `allowed` is false, it shows a no-permission alert
instead of the child. The tab check is a UI convenience. The routes of a page must do their own
server-side check.

The sidebar Settings item gets one child per visible page when there are 2 or more pages. It
opens by default on `/admin/settings/**`. The command palette lists the pages through its "Go to"
logic. General shows once, as "Settings". The lazy-component rule does not apply to pages: they
are files, and Nuxt splits them.

## Register components with `defineAsyncComponent`

Register every component of `contentFieldWidgets`, `dashboardWidgets`, `settingsPanels`, `mailPanels` and
`adminBanners` with plain `defineAsyncComponent`. The code then loads on demand and stays out of
the entry chunk. The registry contract does not change: `component: Component` accepts an async
component. Do not register a bare `() => import()` loader. Core cannot tell it from a functional
component.

```ts
const RecentPostsWidget = defineAsyncComponent(
  () => import('../components/RecentPostsWidget.vue')
)
```

Keep the default `suspensible: true`. Core shows a skeleton for each registered component. Each
core renderer wraps the component in its own `<Suspense>`, so the page, the form and the grid do
not wait for a chunk:

- `PlutoContentField`: `PlutoSkeletonField` (a label line and an input bar, taller for
  `richtext` and `media`).
- `PlutoDashboardWidgets`: `PlutoSkeletonWidget`, a card of fixed height per `colSpan`.
- `pages/admin/settings.vue`: `PlutoSkeletonWidget` with `variant="panel"`.
- `layouts/admin.vue`: an empty fallback. A banner never blocks the layout.

The navbar actions (`navbarActions`) stay eager on purpose.

In dev, `definePlutoExtension` logs a `console.warn` once per component that is not async (it
checks `__asyncLoader`; see `app/composables/internal/async-component.ts`). The check is
`import.meta.dev` only, so production has no cost. Test: `test/async-component.test.ts`.

## No bridge to `@plutocms/utils`

The old composables of `@plutocms/utils` (`useNavbarAdmin()`, `useNavbarAdminActions()`,
`useSidebarAdminActions()`) and the registry `navbar` field are gone. Core always renders its own
navbar (`PlutoAdminNavbarProvider`). A layer adds to it with `navbarActions`, `accountMenu` and
`nav`.

## Why `internal/`

Nuxt auto-imports files under `app/composables/` at depth 1 only. `registry-factory.ts` lives
one level deeper, under `app/composables/internal/`, on purpose: it stays out of Nuxt's
auto-import, and it can be imported directly and unit-tested under plain Vitest, without a full
Nuxt build context. Every other composable in this feature is a thin, Nuxt-aware wrapper around
it.

## Known limits, out of scope for this pass

- `@plutocms/supabase` (0.6.0+) stores settings under free-text, namespaced keys (for example
  `blog.posts_per_page`), not the fixed 3-value enum it started with — see
  `db/migrations/003_settings_generic_keys.sql` in that repo. A layer other than core can
  register its own settings panel and persist a genuinely new key through it, as long as the
  key is namespaced with the layer's own name so two layers can never collide.
- `usePlutoAdminPages()` is not wired into any page's UI yet (no
  breadcrumb component). It ships so a later pass can build on it.
- There is no drag-and-drop, per-user layout persistence, or relative (`before`/`after`)
  ordering. `order` is a plain number.
