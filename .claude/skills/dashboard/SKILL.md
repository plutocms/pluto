# Dashboard

The admin home (`/admin/home`) is core's dashboard: a header and a grid of registered widgets.
Core registers three widgets. A layer adds more with `definePlutoExtension`
(`dashboardWidgets`).

## Files

- `app/pages/admin/home.vue` — the page: the date, the "Dashboard" title, and a create
  button (one "New <label>" button, or a "Create" menu when there are several content types).
  The create commands come from `usePlutoCommandPalette()`.
- `app/components/Pluto/PlutoDashboardWidgets.vue` — the widget grid (3 columns on `lg`).
- `app/components/Pluto/Dashboard/PlutoDashboardContentOverview.vue` — content tiles.
- `app/components/Pluto/Dashboard/PlutoDashboardContentActivity.vue` — the activity chart.
- `app/components/Pluto/Dashboard/PlutoDashboardQuickActions.vue` — quick actions.
- `app/composables/pluto-content-stats.ts` — `usePlutoContentStats()`, the counts.
- `app/composables/pluto-content-activity.ts` — `usePlutoContentActivity(weeks)`.
- `server/api/_pluto/content-activity/[type].get.ts` and `contentActivity()` in
  `server/utils/pluto-content-handlers.ts` — the weekly counts.
- `app/components/Pluto/Skeleton/PlutoSkeletonWidget.vue` — the card skeleton of fixed height.
- `app/plugins/pluto-core-registrations.ts` — registers the three widgets with
  `defineAsyncComponent`. The chart library loads only with the activity widget.

Each widget has its own `<Suspense>` in `PlutoDashboardWidgets.vue`. The grid paints at once.
A card skeleton (9rem for `colSpan` 3, 24rem for 2, 12rem for 1) shows until the widget chunk
loads. The widget then shows its own skeleton while its data loads.

- Tests: `test/content-stats.test.ts`, `test/content-handlers.test.ts` (`contentActivity`).

## Translation

All dashboard text is translated (`pluto.dashboard.*`, `pluto.pages.dashboard`). Numbers and dates
use `n()` and `d()` from `usePlutoI18n()`, so they follow the admin language. The widget titles
are keys that `usePlutoDashboardWidgets` resolves. See the i18n skill.

## Core widgets

| id                 | order | colSpan | Shows                                        |
| ------------------ | ----- | ------- | -------------------------------------------- |
| `content-overview` | 0     | 3       | One tile per content type                    |
| `content-activity` | 10    | 2       | Items created per week, last 12 weeks        |
| `quick-actions`    | 20    | 1       | Create commands and a few admin destinations |

`content-overview` and `content-activity` are disabled (`enabled`) while no content type is
registered. A layer widget with the default order (100) goes below them.

### Content tiles

Each tile shows the content type's plural label, a tinted icon, and the total. When activity
data exists, it adds "+N this week" (or "none new this week"). For a type with a status
workflow, it adds a meter of the published share and the text "<n> published · <m> drafts".
The meter has `role="meter"` and an `aria-label`, and the text says the same numbers, so the
share never depends on color alone. Each tile links to the type's list.

Counts are headline numbers, so they show as tiles, not as a chart. A site with one content
type would otherwise get a one-bar chart.

`usePlutoContentStats()` counts with `limit=1` list requests, so the adapter returns the count
without the rows: `?limit=1` for the total, and `?limit=1&published=1` for the published count
of a type with a status workflow. Drafts are the total minus the published count. If an
adapter returns no `total`, it sends one request without a limit and counts the rows.

### Activity chart

A trend over time, so it is a chart: a `UChart` area for one content type, lines for several
(with a legend). The series colors come from the admin theme's validated chart palette
(`--ui-chart-*`; see the `admin-theme` skill). A visually hidden table has the same numbers.
The card header shows the total created in the period.

States: a skeleton while loading, an error alert with "Try again", "Activity is not available"
when no adapter can count by creation date, and an empty state when nothing was created.

Data: `GET /api/_pluto/content-activity/<type>?weeks=12` (1 to 52) returns
`{ supported, interval: 'week', points: [{ start, count }] }`, oldest first. Weeks start on
Monday, UTC. The last point is the current week, so far. The route calls the adapter's
optional `countCreated(ctx, { from, to })` once per week. It returns `supported: false` when
the adapter has no `countCreated`, or when it returns `null` (the type has no created
timestamp). The route is at its own path, not `/api/_pluto/content/<type>/activity`, so it
never collides with the `[id]` item route.

`usePlutoContentActivity()` uses one `useAsyncData` key, so the tiles and the chart share one
fetch. `@tanstack/charts` is a dependency of this package, for `UChart`.

### Quick actions

The same Create and Go to commands as the command palette, so the two never disagree. Home is
left out, because the widget is on it.
