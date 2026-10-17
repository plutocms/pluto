# Content overview

This feature adds core's own dashboard widget to `/admin/home`: a "Content" section with one
stat tile for each registered content type.

## Files

- `app/components/Pluto/Dashboard/PlutoDashboardContentOverview.vue` — the widget.
- `app/composables/pluto-content-stats.ts` — `usePlutoContentStats()`, the counts.
- `app/plugins/pluto-core-registrations.ts` — registers the widget in core's one
  `definePlutoExtension` call (`id: 'content-overview'`, `order: 0`, `colSpan: 3`).
- `test/content-stats.test.ts` — unit tests for the composable.

## What a tile shows

- The content type icon and plural label.
- The total number of items.
- For a type with a status workflow: a meter of the published share, and the text
  "<n> published · <m> drafts". The meter has `role="meter"` and an `aria-label`. The text
  label shows the same numbers, so the share never depends on color alone.

Each tile links to the content type's list (`basePath`, or `/admin/content/<name>`).

While the counts load, each tile shows skeletons. If the counts fail to load, the section shows
an error alert with a "Try again" button.

The widget is disabled (through `enabled`) while no content type is registered. The dashboard
then shows its own "No dashboard widgets" message.

## How the counts are made

`usePlutoContentStats()` sends list requests with `limit=1`, so the adapter returns the count
without the rows:

- `GET /api/_pluto/content/<name>?limit=1` gives the total.
- For a type with a status workflow, `GET /api/_pluto/content/<name>?limit=1&published=1` gives
  the published count. Drafts are the total minus the published count.

If an adapter does not return `total`, the composable sends one request without a limit and
counts the rows.

## Why tiles, not a chart

Counts per content type are a few headline numbers. A stat tile shows them better than a bar
chart, and a site with one content type would get a one-bar chart. A chart of items over time
needs timestamps and grouped counts from the adapter, which the adapter contract does not have
yet. That is a planned follow-up: an optional adapter `stats()` method and a `UChart` trend
widget.
