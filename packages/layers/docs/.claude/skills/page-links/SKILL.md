# Page links

Two links connect the public page and the admin form of the same Markdown file.

## From the admin to the page: "View"

- `contentRoutePath(id, prefix = '')` (`shared/utils/content-route.ts`, auto-imported) gives the
  Nuxt Content route of a content id. It strips the number prefixes from each segment and a final
  `index` segment. `prefix` goes in front.
  - `1.getting-started/2.installation` gives `/getting-started/installation`.
  - `1.getting-started/1.index` gives `/getting-started`.
  - `index` gives `/`.
  - With `routePrefix: '/docs'`, `1.start/2.install` gives `/docs/start/install`.
- The docs type sets `previewUrl(item)` to `contentRoutePath(item.id, routePrefix)`. The form toolbar
  of core shows it as the **View** link (a new tab, edit mode only). A new page has no id, so it has
  no link. The layer registers no `View page` action any more.
- The route prefix comes from the `routePrefix` option of the type.

## From the page to the admin: "Edit in admin"

`usePlutoContentEditLink(page, type = 'doc')` (`app/composables/pluto-content-edit-link.ts`) is a
wrapper of core's `usePlutoEditLink(type, () => page.stem)`. It returns a computed value:

- `/admin/content/<type>/<contentIdPath(page.stem)>` for a confirmed staff user with `docs:write`.
- `null` for everyone else.

The staff check is `usePlutoAdminBar().confirmed`, which runs in the browser. So the link appears
after hydration and is never in the server HTML, even when the server renders the admin bar from
its hint. A cached public page holds no editor data.

The `stem` of a Nuxt Content page is the file path without the extension and relative to the
collection source. It equals the content id when the collection source is the content dir
(`source: ''`). A site with another collection source must pass an id that matches the type
`source`.

Use it in a page next to the "edit" link of the table of contents:

```ts
const adminLink = usePlutoContentEditLink(page)
// links.push({ icon: 'i-lucide-pencil', label: 'Edit in admin', to: adminLink.value })
```

## Tests

`test/content-route.test.ts` checks `contentRoutePath` against the paths of the docs template.

## The admin bar: "New Page" and "Edit Page"

Core draws these buttons. The docs type sets `adminBar: true`, so core's content bar actions show
(see "Content buttons" in the admin-shell skill of `@plutocms/core`):

- **New <label>** on every page where the bar shows, `/admin/**` too.
- **Edit <label>** on a public page that calls `usePlutoContentEditLink` (it records the page in
  core's `usePlutoCurrentContent()`). It does not show on `/admin/**`, because the form has the
  View link.

Both need `docs:write`, the `write` capability of the type. The layer registers no navbar action of
its own. A site that wants "Edit Page" on a page must call `usePlutoContentEditLink` there, the
landing page too.

`contentEditPath` and `contentNewPath` are in `shared/utils/content-route.ts` and have tests.
