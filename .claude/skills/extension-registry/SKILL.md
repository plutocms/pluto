# Extension registry

This feature lets a layer plug its admin-UI pieces into core without editing core's files. A
layer calls one function, `definePlutoExtension`, from a plugin. Core collects every layer's
contribution into one reactive registry, and the admin UI renders from that registry.

It adds:

- `shared/types/registry.ts` — the `PlutoExtension` shape and the type of each registrable
  thing (`PlutoNavItem`, `PlutoNavbarShell`, `PlutoNavbarAction`, `PlutoAdminPage`,
  `PlutoDashboardWidget`, `PlutoSettingsPanel`, `PlutoSettingsDriver`), plus `PlutoRegistry`.
- `shared/types/registry.d.ts` — augments `#app`'s `NuxtApp` with an optional `_plutoRegistry`
  field.
- `app/composables/internal/registry-factory.ts` — `createOwnedRegistry()`, the generic,
  owner-keyed store behind every registrable thing. Not auto-imported (see "Why
  `internal/`" below).
- `app/composables/pluto-registry.ts` — `usePlutoRegistry()`, the lazy per-app registry
  container.
- `app/composables/pluto-extension.ts` — `definePlutoExtension(definition)`, the one function a
  layer author calls.
- `app/composables/pluto-navbar.ts` — `usePlutoNavbarShell()` and `usePlutoNavbarActions()`.
- `app/composables/pluto-admin-nav.ts` — `usePlutoAdminNav()`, the sidebar nav.
- `app/composables/pluto-admin-pages.ts` — `usePlutoAdminPages()`, page metadata.
- `app/composables/pluto-dashboard.ts` — `usePlutoDashboardWidgets()`.
- `app/composables/pluto-settings.ts` — `usePlutoSettingsPanels()` and `usePlutoSettings()`.
- `app/plugins/pluto-core-registrations.ts` — core's own Home and Settings nav entries and
  page metadata.
- `app/components/Pluto/Admin/PlutoDashboardWidgets.vue` — renders every registered dashboard
  widget on `/admin/home`.
- `app/pages/admin/settings.vue` — renders every registered settings panel, backed by whichever
  settings driver is registered.
- `test/registry.test.ts` — unit tests for `createOwnedRegistry`, run under plain Vitest.

## The six registrable things

A layer's `definePlutoExtension` call can set any of these. Every field is optional; a layer
sets only what it has.

| Field | Type | Purpose |
|---|---|---|
| `navbar` | `PlutoNavbarShell` | The whole admin top bar. One extension normally provides it. |
| `navbarActions` | `PlutoNavbarAction[]` | Small buttons rendered inside the navbar. |
| `nav` | `PlutoNavItem[]` | Sidebar entries, with optional `children`. |
| `pages` | `PlutoAdminPage[]` | Metadata (title, icon, parent) for a route Nuxt already made from a file. |
| `dashboardWidgets` | `PlutoDashboardWidget[]` | Cards shown on `/admin/home`. |
| `settingsPanels` | `PlutoSettingsPanel[]` | Forms shown on `/admin/settings`. |
| `settingsDriver` | `PlutoSettingsDriver` | Load/save functions for settings storage. One layer normally provides it. |

Every entry (`PlutoNavItem`, `PlutoDashboardWidget`, and so on) extends `PlutoEntry`:

- `id` — unique inside the extension. Core stores it as `"<extensionId>:<id>"`, so two layers
  can each use the id `home` without a clash.
- `order` — lower comes first. Default 100. Core reserves `0` for Home and `1000` for Settings,
  so a normal layer's items sort between them without setting `order` at all.
- `enabled` — an optional function called inside a `computed`. Return `false` to hide the entry.
  Because it runs inside the registry's own reactive computation, a value it reads (for example
  a feature flag ref) changing later shows or hides the entry automatically.

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
      { id: 'posts', label: 'Posts', icon: 'lucide:file-text', to: '/admin/posts' },
    ],
    pages: [
      { id: 'posts', path: '/admin/posts', title: 'Posts', icon: 'lucide:file-text' },
    ],
    dashboardWidgets: [
      { id: 'recent-posts', component: RecentPostsWidget, colSpan: 2 },
    ],
  })
})
```

Use the package's `$meta.name` (for example `'supabase-blog'`) as the extension `id`. This
keeps ids stable across a monorepo and matches how core discovers layer names elsewhere.

## Compatibility bridge with `@plutocms/utils`

Three composables in `@plutocms/utils` predate this registry: `useNavbarAdmin()`,
`useNavbarAdminActions()`, and `useSidebarAdminActions()`. Every consumer composable in this
feature (`usePlutoNavbarShell`, `usePlutoNavbarActions`, `usePlutoAdminNav`) reads both the new
registry and these old composables, and merges the two. A layer that still calls the old
composables keeps working, unchanged, with no migration required in this pass.

This bridge is temporary. It exists only so an unmigrated layer is not broken by this change.
Removing it, and migrating every layer to `definePlutoExtension`, is separate future work, not
covered here.

## Why `internal/`

Nuxt auto-imports files under `app/composables/` at depth 1 only. `registry-factory.ts` lives
one level deeper, under `app/composables/internal/`, on purpose: it stays out of Nuxt's
auto-import, and it can be imported directly and unit-tested under plain Vitest, without a full
Nuxt build context. Every other composable in this feature is a thin, Nuxt-aware wrapper around
it.

## Known limits, out of scope for this pass

- `usePlutoSettings()` can load and save values for a settings *panel* that is already
  registered, but it cannot yet persist a brand-new setting *key* — `@plutocms/supabase`'s
  settings table still stores a fixed 3-value enum, not generic keys. Migrating that table is
  separate follow-up work in a different repo.
- `usePlutoAdminPages()` has no legacy bridge and is not wired into any page's UI yet (no
  breadcrumb component). It ships so a later pass can build on it.
- There is no drag-and-drop, per-user layout persistence, or relative (`before`/`after`)
  ordering. `order` is a plain number.
