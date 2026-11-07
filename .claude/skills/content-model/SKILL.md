# Content model

This feature lets a layer declare a content type once — its fields, its storage table, its
publish workflow — as one typed contract. A later wave reads that contract to generate a server
adapter and an admin UI.

**Wave 1** shipped the contract itself: types, validation, mapping helpers, registry wiring, and
the three consumer composables. **Wave 2** added core's server side: the server-side content
registry, the generic list/get/create/update/delete routes, and the `PlutoContentAdapter`
contract a backend layer implements against. **Wave 3** (this wave) adds the generic admin UI:
the two data-fetching composables, `PlutoContentField` and its eight built-in widgets,
`PlutoContentList` and `PlutoContentForm`, the three generated `/admin/content/**` pages, and
nav/pages derivation for auto-routed content types. **Still missing after this wave:** a real
adapter implementation, and per-layer adoption (a layer switching its own hand-written admin
pages over to the generic ones) — both `@plutocms/supabase`'s job, in later waves, against
different repos. See "Known limits" at the end of this file for the exact remaining list.

It extends the [extension registry](../extension-registry/SKILL.md) and builds on the same
pattern as [permissions](../permissions/SKILL.md). Read both first. This feature adds:

**Wave 1:**

- `shared/types/content.ts` — `PlutoField` and its eight concrete field types, and
  `PlutoContentType`, the content-type contract.
- `shared/utils/content.ts` — `defineContentType(type)`.
- `shared/utils/content-validate.ts` — `validateContentPayload(type, payload, options)`.
- `shared/utils/content-map.ts` — `fieldColumn`, `mapFieldsToColumns`, `mapColumnsToFields`.
- Two new fields on `PlutoExtension`: `contentTypes`, `contentFieldWidgets`.
- Two new registry buckets on `PlutoRegistry`, matching those fields.
- `app/composables/pluto-content-types.ts` — `usePlutoContentTypes()`.
- `app/composables/pluto-content-fields.ts` — `usePlutoContentFieldWidget(field)`.
- `test/content-registry.test.ts`, `test/content-define.test.ts`, `test/content-validate.test.ts`,
  `test/content-map.test.ts` — unit tests for everything above.

**Wave 2:**

- `shared/types/content.ts` (extended) — `PlutoContentQuery`, `PlutoContentListResult`,
  `PlutoContentContext`, `PlutoContentAdapter`, and an optional `hooks` field on
  `PlutoContentType`.
- `server/utils/pluto-content.ts` — the server-side content-type and adapter registry.
- `server/utils/pluto-content-handlers.ts` — the generic list/get/create/update/delete logic.
- `server/api/_pluto/content/[type]/index.get.ts`, `index.post.ts`, `[id].get.ts`,
  `[id].patch.ts`, `[id].delete.ts` — thin route wrappers around the handlers above.
- `test/fixtures/memory-content-adapter.ts` — an in-memory `PlutoContentAdapter`, test-only.
- `test/content-server-registry.test.ts`, `test/content-handlers.test.ts` — unit tests for
  everything above.

**Wave 3:**

- `app/composables/pluto-content-list.ts` — `usePlutoContentList(typeName)`.
- `app/composables/pluto-content-item.ts` — `usePlutoContentItem(typeName, id)`.
- `app/components/Pluto/Content/PlutoContentField.vue` — resolves and renders one field's widget.
- `app/components/Pluto/Content/fields/PlutoField{Text,Slug,Number,Boolean,Date,Select,Reference}.vue`
  — the eight built-in widgets (`PlutoFieldText` covers both `text` and `textarea`).
- `app/components/Pluto/Content/PlutoContentList.vue`, `PlutoContentForm.vue` — the generic
  list and form components.
- `app/pages/admin/content/[type]/index.vue`, `new.vue`, `[id].vue` — the three generated pages.
- `app/plugins/pluto-core-registrations.ts` (extended) — registers the eight built-in widgets,
  alongside core's existing Home/Settings nav anchors. It also registers the `post-canvas` widget
  by name only (`widget: 'post-canvas'`): the post editor of a Markdown `richtext` body (see the
  git-cms skill). A `richtext` widget that the post editor shows must accept the `canvas`
  prop.
- `app/composables/pluto-admin-nav.ts`, `pluto-admin-pages.ts` (extended) — a third nav source,
  and two page-metadata entries, synthesized per auto-routed content type.
- `test/pluto-content-list.test.ts`, `test/pluto-content-item.test.ts`,
  `test/pluto-admin-nav-content.test.ts` — unit tests for everything above.

## Declaring a content type

Wrap a content-type literal in `defineContentType`. This gives TypeScript the narrowed field
union, and runs a few dev-only sanity checks:

```ts
// shared/utils/content.ts and shared/types/content.ts are auto-imported,
// the same way every other file under shared/ and app/composables/ is.
const post = defineContentType({
  name: 'post',
  label: 'Post',
  labelPlural: 'Posts',
  source: 'posts',
  titleField: 'title',
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Title',
      required: true,
      inList: true,
    },
    { name: 'body', type: 'richtext', label: 'Body' },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
    },
  ],
  status: {
    values: [
      { label: 'Draft', value: 'draft' },
      { label: 'Published', value: 'published' },
    ],
    default: 'draft',
    publishedValue: 'published',
  },
})
```

`defineContentType` is an identity function. It returns `type` unchanged. Its only job is type
inference at the call site, plus these dev-only (`import.meta.dev`) warnings, printed with
`console.warn` and never thrown:

- A duplicate field `name`.
- `titleField` that does not name any field.
- `slug.field` that does not name a field of type `'slug'`.
- A `select` field with an empty `options` array.
- `status` with an empty `values` array.

A content type with one of these problems still loads. The warning exists to catch a typo
before it reaches a later wave's generated UI or server adapter, where it would fail silently or
confusingly instead.

## `name` vs `id`: read this before you register a content type

A content type is registered as a `PlutoContentTypeEntry`, which extends `PlutoEntry` (so it has
an `id`) and wraps the content type itself under `type` (so `type.name` is the content type's own
identifier). These two are not interchangeable, for the exact same reason `PlutoCapability` keeps
`key` separate from `id` (see the permissions skill).

The registry rewrites every entry's `id` to `<extensionId>:<id>` (see
`app/composables/internal/registry-factory.ts`). This is correct and wanted for the registry
entry's own identity — it is how two layers can both use the id `post` without colliding. But
`PlutoContentType.name` is not a registry id. It is a value used as a URL path segment (a later
wave's generated routes) and as a lookup key (`usePlutoContentTypes().byName(...)`, an adapter's
own storage logic). If a content type reused `id` as its `name`, the registry would silently
corrupt it: registering `id: 'post'` under the layer `supabase-blog` would leave the real name
reading `supabase-blog:post`, not `post`.

Always read `type.name` for the real content type identity. Never read a
`PlutoContentTypeEntry`'s `id` for that purpose — register a content type with a plain,
un-prefixed `id` (for example `posts`), and put the real, stable name in `type.name` (`post`).

## Field types

`PlutoField` is a union of eight concrete field types, each narrowing `PlutoFieldBase.type` to
one literal: `text`, `textarea`, `richtext`, `slug`, `number`, `boolean`, `date`, `select`,
`reference`, `media`. Every field shares `name`, `type`, `label`, and a handful of optional
display hints (`inList`, `inForm`, `order`, `region`, `widget`). See `shared/types/content.ts`
for the full shape of each concrete type — `PlutoNumberField.min`/`max`, `PlutoSelectField.options`,
and so on.

`name` is the field's key on a `PlutoContentItem` and its default storage column. Set `column`
only when the storage column name differs from `name` — see "Field-to-column mapping" below.

Set `default` on a field to give a new item a first value in the form (`PlutoContentForm`). The form
copies it, so the type keeps its own value. A `remember` reference field then replaces it with the
value that the user saved last time (see the authors skill). The first values do not make a new
form dirty. The server does not apply `default`.

Set `listFormat` on a field to control the text of its cell in the generic list. See "Formatting a list cell" below.

Set `virtual: true` on a field that has no storage column at all. A virtual field still passes
through validation and the generic form payload, but `mapFieldsToColumns` and
`mapColumnsToFields` both skip it — its value never reaches a database write. Use it when a
layer's `hooks.afterCreate`/`afterUpdate` needs extra data from the form that it reconciles into
a different table itself (see "Hooks" below).

## Validating a payload

`validateContentPayload(type, payload, options)` checks a field-keyed payload against a content
type's field rules, with no I/O and no Nuxt/Vue dependency:

```ts
const errors = validateContentPayload(post, { title: '', body: 'hi' })
// [{ field: 'title', message: '"Title" is required.' }]
```

Pass `{ partial: true }` for a partial update (a PATCH): a required field missing from the
payload entirely is not an error, because omitting a field is not the same as clearing it. A
required field present in the payload with an empty value (`''`, `null`, `undefined`) is still an
error, partial or not.

This wave checks `required`, `number` (numeric, `integer`, `min`, `max`), `boolean`, `select`
(value must match an option), text-family `maxLength`, and `reference` (code `reference`: a list of
text or number ids for a `multiple` field, else one id). A `date` or `media` field only gets the
`required` check. An empty list (`[]`) counts as empty for `required`, for a `multiple` `reference`
and a `multiple` `media` field.

Being pure TypeScript, the same function will run on both an app composable and a server route
once a later wave adds one — the payload is valid or it isn't, regardless of which side asks.

## Field-to-column mapping

A content type's fields and its storage table do not always share names. Three pure functions in
`shared/utils/content-map.ts` translate between the two, for an adapter (a later wave) to use:

- `fieldColumn(field)` — the storage column for one field. Falls back to `field.name`.
- `mapFieldsToColumns(type, payload)` — a field-keyed payload to a column-keyed one, for every
  field present in `payload`. A field absent from `payload` stays absent from the result.
- `mapColumnsToFields(type, row)` — a column-keyed row to a field-keyed `PlutoContentItem`, plus
  the primary key column (`type.primaryKey`, default `'id'`) mapped to `item.id`.

## `usePlutoContentTypes()`

Every content type declared by every layer, in registry order:

```ts
const { items, byName } = usePlutoContentTypes()

items.value // PlutoContentTypeEntry[]
byName('post') // PlutoContentType | undefined — looks up by type.name, not entry.id
```

### Content type extensions

A content type can have two owners, for example `post` (the Git module of core, or the Supabase
blog layer). A layer that is not the owner adds fields to it with a content type extension. Core
knows nothing of what the layer adds.

```ts
// shared: the same object works on the server and on the client
const extension: PlutoContentTypeExtension = {
  id: 'seo',
  order: 100, // optional, lower runs first
  extend: (type) =>
    type.name === 'post'
      ? {
          ...type,
          fields: [
            ...type.fields,
            { name: 'seoTitle', type: 'text', label: 'SEO title' },
          ],
        }
      : type,
}
```

- `extend` is pure. It gets a type and returns a new one (or the same object). It runs for every
  type, so it checks `type.name`. A later extension with the same `id` replaces the earlier one.
- Server: `extendContentTypes(extension)` from a `server/plugins/*.ts` file. The registry keeps
  the raw type. `getContentType` and `listContentTypes` give the extended type, so the handlers,
  the public API and the static index all see the new fields. The extended types are cached. Each
  `registerContentType` and `extendContentTypes` clears the cache. The order does not depend on
  the order of the plugins: an extension also applies to a type that registers later.
- Client: the `contentTypeExtensions` field of `definePlutoExtension`
  (`PlutoContentTypeExtensionEntry`: the same shape, as a registry entry). `usePlutoContentTypes()`
  gives the extended types in `items` and `byName`. The registry entry of the type
  (`registry.contentTypes`) stays raw.
- Extensions run by `order` (default 100), then by first registration. In dev, an extended type goes
  through the checks of `defineContentType`.
- The layer sets `column` on each new field. The storage of the new fields is the job of the
  layer: a Supabase column, or a `files.frontmatter` hook for the Git CMS.
- Tests: `test/content-server-registry.test.ts`, `test/content-registry.test.ts`.

## `usePlutoContentFieldWidget(field)`

Resolves the component that should render one field in the generic content form (a later wave):

```ts
const component = usePlutoContentFieldWidget(field) // ComputedRef<Component | undefined>
```

Resolution order: an exact `field.widget` name match first, then the last-registered
`PlutoContentFieldWidget` whose `fieldType` matches `field.type`, else `undefined`. This wave
adds no fallback placeholder component — deciding what to show when nothing resolves is later,
UI-wave work.

## References and terms

A `reference` field with a `target` stores the id of an item of another content type, or a list of
ids (`multiple`). `create` lets the admin widget create a new item of the target inline. Core
expands the ids in the public API, filters by them and keeps them true on a rename or a delete (Git
CMS). `shared/utils/content-reference.ts` has the helpers (`referenceValue`, `referenceFieldIds`,
`isTargetReference`, `referenceFieldsTo`). The full detail, with the tag and category types, is in the
[tags-and-categories](../tags-and-categories/SKILL.md) skill. `publicFields` (more target fields in
each public reference) and `remember` (a new item gets the last saved value) are in the
[authors](../authors/SKILL.md) skill.

## Media

The media library (the record, the driver of a backend, the routes, the `media` widget and the
picker) is in the media skill. A `media` field stores one media id, or a list of ids
(`multiple`). `accept` narrows the file types. The public API gives the records in place of the
ids.

## The server-side registry

`server/utils/pluto-content.ts` holds three things: a `Map<string, PlutoContentType>` (keyed by
`type.name`), the content type extensions (see "Content type extensions") and a single `PlutoContentAdapter | undefined` variable — both plain module-scope
state:

```ts
registerContentType(type) // adds or overwrites one content type, by type.name (the raw type)
extendContentTypes(extension) // adds or replaces (by id) an extension of every type
getContentType(name) // PlutoContentType | undefined, with the extensions applied
listContentTypes() // PlutoContentType[], extended, in registration order
registerContentAdapter(adapter) // replaces whatever was registered before — last wins
getContentAdapter() // PlutoContentAdapter | undefined
```

This is a **plain module-scope singleton**, on purpose — a different design from the client
registry (`usePlutoRegistry`, which lives on `nuxtApp` specifically to avoid module-scope state).
That difference is not an oversight. The client registry avoids module scope because a
module-scope object on the server would leak state between requests and between apps during SSR.
None of that risk applies here:

- Registration happens once, at Nitro startup, from a layer's own `server/plugins/*.ts` file —
  never per request.
- The registered values are static definition objects (a `PlutoContentType`, a
  `PlutoContentAdapter`). They hold zero per-request state.
- Anything that actually varies per request — the caller's identity, their session — travels in
  `PlutoContentContext.event`, passed fresh into every adapter call. It never touches the
  registry.

If you know the SSR-leakage reasoning behind the client registry, do not assume it applies here
too. It does not, for the reasons above.

## The generic content routes

Five routes, all under the `/api/_pluto/content/` prefix. They are for the admin. The leading
underscore marks an internal route: not a stable contract, and not for a public site (that is the
public API, below). The rule for every official layer: core's internal routes are
`/api/_pluto/<area>/...` (`content`, `content-activity`, `content-revisions`, `content-revision`, `content-backup`, `mail`; the CMS `auth` and `cms`), and a
layer's internal routes are `/api/_pluto/<layer>/...` (for example `/api/_pluto/supabase/...`,
`/api/_pluto/shop/...`), REST style: nouns in the path, the method says the action. Core's
middleware `server/middleware/pluto-origin.ts` blocks a cross-site write to `/api/_pluto/**`
(`isPlutoSameOriginRequest`, 403 `pluto.errors.crossOrigin`), for every layer.

| Route                             | Method | Calls               |
| --------------------------------- | ------ | ------------------- |
| `/api/_pluto/content/[type]`      | GET    | `listContentItems`  |
| `/api/_pluto/content/[type]`      | POST   | `createContentItem` |
| `/api/_pluto/content/[type]/[id]` | GET    | `getContentItem`    |
| `/api/_pluto/content/[type]/[id]` | PATCH  | `updateContentItem` |
| `/api/_pluto/content/[type]/[id]` | DELETE | `deleteContentItem` |

Each route file is a thin wrapper: resolve `type` from the `[type]` route param through
`requireContentType`, build a `PlutoContentContext`, call the matching handler function from
`server/utils/pluto-content-handlers.ts`, and return its result. The real logic lives in that
handlers file, as plain exported async functions, so it can be unit-tested by calling it
directly — no live Nitro server, no `@nuxt/test-utils` — the same way this workspace already
tests everything else. The list route accepts `limit` and `offset`, and the admin list query of
`parseAdminListQuery` (`shared/utils/content-list.ts`, the same parser as the list page):

- `search`: trimmed, cut at 200 characters. Both adapters search the title field.
- `status=<value>`: a value of `type.status.values`. The adapter gets `query.status`.
- `filter[<field>]=<value>`: a field that `isListFilterField` allows (a `reference` with a
  `target`; a `select` or a `boolean` that is `inList` or has `filter: true`; never
  `filter: false`). A select value must be one of its options, a boolean value `true` or
  `false`. The adapter gets `query.filters`.
- `sort=<field>` or `-<field>`: a field that `isListSortField` allows (an `inList` field of type
  `text`, `textarea`, `slug`, `number`, `select`, `boolean` or `date`, not `sortable: false`).
  Without it, `type.defaultSort`.

A value that the type does not allow gives 400 `pluto.errors.invalidQuery` with the key as
`name`. It also accepts `published=1` (or `true`) for a type with a status workflow: the adapter then
gets `includeUnpublished: false` and returns published rows only. The dashboard content
overview uses it with `limit=1` to count published rows (see the `dashboard` skill).

`PlutoContentQuery.status` is part of the adapter contract: only the items with that status
value; an item with no stored status has `type.status.default`; a type with no workflow ignores
it. It does not add drafts by itself (core sets `includeUnpublished`), so an anonymous caller of
the Git CMS still sees no draft. The contract suite (`test/contracts/content-adapter.contract.ts`)
tests it; `@plutocms/supabase` implements it too.

An adapter may also implement the optional `countCreated(ctx, { from, to })`. It counts the
items created from `from` (inclusive) to `to` (exclusive), both ISO timestamps, and returns
`null` when the type has no created timestamp. `GET /api/_pluto/content-activity/<type>` calls
it once per week for the dashboard activity chart. Without it, the chart leaves the type out.
`@plutocms/supabase` implements it with one exact-count HEAD query per range.

An adapter may also implement the optional `readFile(ctx, relativePath)`. It reads one raw file of
the type by a path relative to the type folder (for example `1.start/.navigation.yml`) and returns
`{ text, version? }`, or `null`. `version` equals the `_version` of an item for the same file. The
file adapter of the CMS implements it for the `github` and `fs` stores. It refuses (`null`) an
empty path, `..`, `.` and empty segments, an absolute path, a drive letter, a backslash, a `%`
escape and a control character, so the result stays in the type folder. A `.md` file follows the
rules of `get`: it must be a usable id (not in `files.exclude`) and visible to the caller, so a
draft never reaches an anonymous caller. A layer that serves public pages calls
`markPublicRead(event)` first (below).

## `markPublicRead(event)`: public reads from a layer

`markPublicRead(event)` (`server/utils/pluto-public-read.ts`) is auto-imported in Nitro for every
layer. It marks the request as a public read: the CMS adapter then treats the caller as anonymous
(no session cookie read, published items only, the same answer for everyone). Call it first in a
route that serves public pages. It works with or without the CMS module: when the CMS is off, no
adapter reads the mark and the call does nothing. `isPublicRead(event)` reads the mark. A backend
adapter (for example `@plutocms/supabase`) also reads it and answers as an anonymous caller.

## The public API

Core serves every content type that opts in on a stable, versioned, read-only API. It is how a
site in any framework or stack reads Pluto (headless), and how a Nuxt site does too.

| Route                                           | Answer                                             |
| ----------------------------------------------- | -------------------------------------------------- |
| `GET /api/pluto/v1/content/<type>`              | `{ data: Item[], meta: { total, limit, offset } }` |
| `GET /api/pluto/v1/content/<type>/<id or slug>` | `{ data: Item }` (the id can hold slashes)         |

- Opt-in: `type.api.public` must be `true`. Any other type, and an unknown type, answers 404 (the
  API does not tell that a private type exists).
- Every read is a public read: `markPublicRead` runs first, the adapter gets
  `includeUnpublished: false`, and core checks the status again (`isPublishedItem`), so a draft
  never comes out, even when an adapter returns one (for example a signed-in editor's cookie on a
  same-origin call).
- Query of the list: `limit` 1 to 100 (default 20), `offset` (a bad value uses the default),
  `search` (the title, at most 200 characters), `sort` (`field` or `-field`: a public field, or
  `createdAt`, `updatedAt`, `publishedAt`), `filter[field]=value` (equality on a public field;
  the adapter gets `query.filters` as text). Any other key is ignored. A sort or a filter on a
  field that the answer does not have gives 400 (`pluto.errors.invalidQuery`). A filter on a
  `reference` field with a `target` takes the id or the slug of the target item (see "References and
  terms"); a value that names no published item gives an empty list. A filter on a list field
  matches when the list has the value (`PlutoContentQuery.filters`).
- The answer of an item (`toPublicData`): `id`, the public fields (`api.fields`, else every field
  that is not `virtual`), and `createdAt`, `updatedAt`, `publishedAt` from the item keys that
  `adapter.timestampKeys(type)` names. Core expands the public `reference` fields that have a public
  `target` to `{ id, label, slug? }` (a list for `multiple`), after the media. Then `adapter.toPublic` (the CMS Markdown adapter adds
  `excerpt` to a list item and `html` to one item), then `type.hooks.toPublic` (server only, for
  relations and URLs). Both get `{ view: 'list' | 'item', item, batch }`: `batch` is every item of
  the answer, so a hook loads related rows once and keeps them on `ctx.event.context`.
- Headers: `Cache-Control: public, s-maxage=<plutoApi.maxAge>, stale-while-revalidate=300`
  (`no-store` when `maxAge` is 0); no cookie. CORS from `server/middleware/pluto-api-cors.ts`:
  `runtimeConfig.plutoApi.cors` is `true` (`Access-Control-Allow-Origin: *`, the default), a list
  of origins (the matching origin and `Vary: Origin`), or `false`. Methods `GET, HEAD, OPTIONS`,
  never credentials. A preflight answers 204. Env: `NUXT_PLUTO_API_CORS`, `NUXT_PLUTO_API_MAX_AGE`.
- Errors: `createPlutoError` (`{ statusCode, statusMessage, data: { i18n } }`).
- A layer's own public routes go under `/api/pluto/v1/<layer>/...` (for example the Nuxt Content
  layer's page, navigation and surround), with the same envelope (`{ data }`).
- Files: `server/utils/pluto-public-api.ts` (the logic), `server/utils/pluto-api-{config,options,cors}.ts`,
  `server/api/pluto/v1/content/[type]/*`, `shared/types/public-api.ts`, `shared/utils/public-api.ts`
  (`PLUTO_API_PREFIX`, `plutoContentApiPath`, `plutoPublicQueryParams`), `app/composables/pluto-public.ts`.
- Composables: `usePlutoPublicList<T>(type, query)` and `usePlutoPublicItem<T>(type, id)`, `useFetch`
  wrappers that run on the server. `data.value` is the answer above. The site composables below
  wrap them.
- A static site (`public.plutoPublicApi.static`, set by the `pluto-static` module of core in every static build): in the
  browser, `usePlutoPublicList` answers from the prerendered public index
  (`/api/pluto/v1/index.json`, `PlutoPublicIndex`, `queryPublicIndex` of
  `shared/utils/public-index.ts`). See the git-cms skill ("Static build").

## Site composables

`app/composables/pluto-site-content.ts`, inspired by Nuxt: one call gives a page what it needs.

- `definePlutoContent<TItem, TSummary = TItem>(type, { list?, ogType? })` returns `useList` and
  `useItem` for one public type. Core and the layers define their ready-made composables with it;
  an app defines its own (`export const { useList: useEvents, useItem: useEvent } = ...`).
- `useList(options)` (`PlutoContentListOptions`): `limit` (default 20, clamped 1..100), `search`,
  `sort` and `filter` (values or getters), and `page`. `page` defaults to `?page=` of the URL;
  setting the returned `page` pushes it (no key for page 1); a number or a getter fixes it;
  `false` keeps page 1. `search` defaults to `?q=` of the URL: the returned `search` is the search
  box (`v-model`), it writes `q` with `router.replace` 300 ms after the last change (and drops
  `page`), and a change of the URL (back, forward) fills the box. A value or a getter: that search;
  `false`: none. A new search goes back to page 1. It returns the `useFetch` refs plus `items`,
  `total`, `page`, `pages`, `search` and `pageLink(n)` (a `NuxtLink` target with `?page=`).
- `useItem(id, options)` (`PlutoContentItemOptions`): the `useFetch` refs plus `item`. Awaited,
  a failure throws `createError` (404 for a missing item or a draft, else the status of the error)
  unless `notFound: 'null'`. It calls `usePlutoEditLink` (`editLink: false` skips it) and
  `useSeoMeta` (`seo: false` skips it): the title field, `excerpt` or `description`, `og:image`
  from the first media field (absolute, through `usePlutoSite().absoluteUrl`; none while the site
  root is not known), `og:type` from `ogType`. Then it calls each `contentHead` hook (see below).
  Every composable call happens before the first `await`, so the Nuxt context is still there.
  Drafts: while the admin bar shows (an editor), the request carries `?drafts=1`
  (`usePlutoPublicItem(type, id, { drafts })`), so an editor sees a draft on the real page; the
  returned `draft` is true then. `drafts: false` turns it off.
- `useSurround(id, { sort?, filter? })`: `previous` and `next` (`usePlutoPublicSurround`, the
  surround route), in the order of `defaults.list.sort`. `useAdjacentPosts(slug)` names them
  `newer` and `older`.
- `usePlutoSite()` (`app/composables/pluto-site.ts`): `name` (site info, else `websiteName`
  unless 'Untitled'), `description` (`websiteDescription`, a new public runtime key, env
  `NUXT_PUBLIC_WEBSITE_DESCRIPTION`), `url` (`websiteUrl`, else site info, else the request origin), `root` and `absoluteUrl(path)`.
  The site URL: `public.websiteUrl` (env `NUXT_PUBLIC_WEBSITE_URL`) is the address of the site. The
  build default is `https://$VERCEL_PROJECT_PRODUCTION_URL` on Vercel, else the `URL` of Netlify,
  else empty. The GitHub Pages workflow sets it from `steps.pages.outputs.base_url`. `url` is
  `websiteUrl`, else the site info URL, else the request origin. `root` is the root URL for
  absolute links, with the base path and no trailing slash. It comes from `websiteUrl`, else from
  the request origin, and never from the site info, so the server and the browser agree. On a
  static build without `websiteUrl` it is `''`. `absoluteUrl(path)` puts a site path under the root
  (`''` with no root; a full URL stays). The helpers are in `shared/utils/url.ts`:
  `siteRootUrl({ websiteUrl, origin, baseURL })` adds the base path only when the path of
  `websiteUrl` does not end with it, and `absoluteSiteUrl(pathOrUrl, root)`. Never use
  `new URL('/x', root)`: it drops the base path (`/repo/`). A server route calls
  `getPlutoSiteRoot(event)` (`server/utils/pluto-site.ts`): the same root, or `null` on a static
  build without `websiteUrl`. Tests: `test/site-url.test.ts`, `test/pluto-site-server.test.ts`.
- `contentHead` (registry bucket, `PlutoContentHead`): `{ id, contentType: name | '*', setup({ type,
item, ogType }) }`. `useItem` calls each matching `setup` right after its own `useSeoMeta`, in
  registry order, inside the same Nuxt context. So a hook can call `useHead` and `useSeoMeta` and
  override the core tags. `item` is a computed (`null` while it loads). `seo: false` skips the
  hooks. A layer uses it to add tags to every `usePost` page with no change to the page.
  Test: `test/site-content-composables.test.ts`.
- `usePlutoSiteHead()`, for the public layout: the title template (`Title - Site`, the site name
  alone for a page with no title or the same title), `og:site_name`, and the site description as
  the default `description` / `og:description`; a page that sets its own wins. Test:
  `test/site-composables.test.ts`.
- `formatPublishedDate(item, { locale?, timeZone?, ...Intl options })` (`shared/utils/public-api.ts`):
  `publishedAt`, else `createdAt`, as text; `''` with no date or a bad one. Defaults: `'en'`,
  UTC (the server and the browser give the same text, so no hydration mismatch), and
  `dateStyle: 'medium'` when no format option is given. Test: `test/published-date.test.ts`.
- `readingMinutes(html, wordsPerMinute = 220)` (same file): the words of the text (tags removed)
  over the rate, rounded, at least 1. Test: `test/reading-minutes.test.ts`.
- `extendPlutoAsyncData(result, keys)` adds named keys to the thenable result and to what it
  resolves to. `usePosts` and `usePost` (core, type `post`, both backends, sorted by
  `-publishedAt`, `og:type` article) add `posts` and `post`. `@plutocms/supabase-shop` adds
  `useProducts`, `useProduct` and `useProductCategories` the same way.
- `useTags`, `useTag`, `useCategories` and `useCategory` (core, types `tag` and `category`, sorted by
  `title`) add `tags`, `tag`, `categories` and `category`. The posts of a term:
  `usePosts({ filter: { tags: slug } })`.
- Types (`shared/types/public-api.ts`): `PlutoPost`, `PlutoPostSummary`, `PlutoTerm`,
  `PlutoPublicReference`, the option interfaces.
- Test: `test/site-content-composables.test.ts` (the fetch composables mocked like Nuxt, with
  their own `then`; the Nuxt auto-imports stubbed).
- The public API for these: `getPublicContent(event, type, id, { drafts })` serves a draft only
  when `canReadDrafts` passes: `adapter.authorize` with the read capability of the type, else its
  write capability. No capability, no `authorize`, or a refusal: the read stays anonymous
  (`markPublicRead`) and a draft answers 404. A draft answer has `meta.draft` and
  `Cache-Control: private, no-store`. `getPublicSurround` (`GET /api/pluto/v1/surround/<type>/<id>`,
  anonymous) reads up to `PUBLIC_SURROUND_MAX` (1000) published items in the list order, finds the
  item by id or slug field, and answers `{ data: { previous, next } }` (list shape), 404 when the
  item is not among them.
- Tests: `test/public-api.test.ts`, `test/reference-public.test.ts` and `test/github-public.test.ts`.

## Capability enforcement: read is never checked here

`type.capabilities.read` is **never enforced by these generic routes.** Read that twice — it is
the single easiest thing to get wrong here.

`read` gates the admin nav/list _UI_ in a later wave, nothing in this wave. The generic list and
get routes never throw 401/403 for a missing `read` capability, and never call
`adapter.authorize` for list or get, under any circumstance. The reason: for a type like `posts`,
"read" is not all-or-nothing — an anonymous visitor can read _published_ posts, and only reading
_drafts_ needs a capability. That distinction already lives in the adapter's backing store (RLS,
for the one adapter that exists so far: `status = 'published' OR has_capability('posts:read_drafts')`),
which is the real enforcement point regardless of what this route does.

So: **the generic list/get routes always request `includeUnpublished: true` from the adapter, on
every call, with no capability check.** The adapter's own backing store decides what actually
comes back for whoever is asking. This is safe specifically because these generic routes are
admin-surface-only in intent — a later wave's admin UI is the only consumer. A public-facing read
path is a layer's own hand-written endpoint (as blog's and shop's already are, unchanged), never
this generic one.

## Capability enforcement: write and delete

Write and delete **are** enforced, via `type.capabilities.write` / `type.capabilities.delete`,
by this rule:

1. The type declares no capability for the operation → no check happens. Open to anyone who can
   reach the route.
2. The type declares one, but the registered adapter has no `authorize` method → no check
   happens either. This is the same fail-open rule already documented for
   `usePlutoPermissions().can()` in the permissions skill: with no permissions backend registered
   at all, there is no boundary to enforce here, and RLS (or whatever the adapter's backing store
   does) is still the real gate.
3. The type declares one, and the adapter has `authorize` → `await adapter.authorize(event,
capability)` is called, and left to throw on its own terms.

Do not add stricter checks than this. A type with no declared capability, or an adapter with no
`authorize`, is meant to pass through untouched.

## Hooks

`type.hooks.afterCreate` and `type.hooks.afterUpdate` are server-only, and run after the adapter
call succeeds, before the response goes out:

```ts
hooks: {
  afterCreate: async (ctx, item, rawBody) => { /* ... */ },
  afterUpdate: async (ctx, item, rawBody) => { /* ... */ },
}
```

They exist so a layer with extra logic around a write — the motivating example: `supabase-shop`
reconciling `product_media` rows after a product write — can hook in without a bespoke endpoint
just for that, and without polluting the generic `PlutoContentAdapter` contract with a per-layer
concern. If a hook throws, the error propagates. It is never swallowed, so a failed hook fails
the whole write.

A field with `virtual: true` is how a hook gets data that has no storage column in the first
place. `mapFieldsToColumns` drops a virtual field before the adapter ever sees it, but the
generic form still sends it, so `rawBody` still carries it — `supabase-shop`'s `product_media`
reconciliation reads its media list this way, straight off `rawBody`, with no matching column on
`products`.

## `usePlutoContentList(typeName)` and `usePlutoContentItem(typeName, id)`

Two composables, not one — a deliberate refinement of an earlier design note that described a
single `usePlutoContent`. Splitting list-mode and single-item-mode avoids the exact flaw this
file already warns about for the old `usePost`/`useProduct` pattern (see `supabase-blog`'s
`app/composables/post.ts`, kept only as a cautionary reference, never a pattern to copy):

- **The always-both-fetches flaw.** The old pattern ran a list fetch AND a single-item fetch
  from one composable on every call, and threw away whichever one the caller did not need — a
  list page paid for an item fetch it never used, and an edit page paid for a list fetch it
  never used. `usePlutoContentList` only ever fetches a list. `usePlutoContentItem` only ever
  fetches a single item, and only when `id` is defined — "new entry" mode (`id` is `undefined`)
  never fires a GET at all; `item` starts as an empty object instead.
- **The fake-thenable flaw.** The old pattern returned an object with its own hand-rolled
  `.then()`, so `await usePost()` silently worked but hid which underlying fetch it actually
  waited on. Neither composable here does this. Each returns plain refs and explicit async
  methods — a caller `await`s `refresh()`, `save()`, or `remove()` directly.

```ts
const { items, total, pending, error, refresh, remove } =
  usePlutoContentList('post')
await remove(id) // DELETEs, then refreshes

const { item, pending, error, loadError, refresh, save, remove } =
  usePlutoContentItem('post', () => route.params.id)
await save(payload) // POSTs when id is undefined, PATCHes when id is defined
```

`error` holds the last failure of any call. `loadError` holds only the failure of the item fetch
(`refresh()` and the first load), and it clears when a fetch starts. A form reads `loadError` to
show the load error state, because a failed save must not hide the fields.

`usePlutoContentList(typeName, { pageSize, query })` loads the list page by page. `query` is a
ref or getter of a `PlutoAdminListQuery` (search, status, filters, sort): its keys go with each
page (`adminListQueryKeys`), and a change of the keys loads the list again from the first page. It requests
`?limit=<pageSize>&offset=<n>`, appends each page, and also returns `loadingMore`, `hasMore`,
and `loadMore()`. `hasMore` compares the loaded rows with `total`; without a `total`, a full page
means there may be another one. `remove(id)` then drops the row in place instead of a refetch,
so the loaded pages and the scroll position stay. A response that finishes after a newer
`refresh()` is dropped. Without `pageSize`, one request returns every row, as before (an adapter
can cap it: the Supabase adapter returns at most 1000 rows). `PlutoContentList` uses
`pageSize: 50`.

`id` is read once, with `toValue`, at composable-creation time — not watched for later changes.
A page must mount the form again when the id changes. The generated page `[id].vue` keys the
form on the route id.

## `PlutoContentField` and the eight built-in widgets

`PlutoContentField.vue` resolves a field's widget through `usePlutoContentFieldWidget(field)`
(wave 1) and renders it, passing `field`/`modelValue`/`disabled` through and re-emitting
`update:modelValue` unchanged. It never needs to know which concrete widget it dispatched to —
every widget shares that same three-prop contract.

The widgets register with `defineAsyncComponent`. `PlutoContentField` wraps the widget in its own
`<Suspense>` and shows `PlutoSkeletonField` (a label line and an input bar) while the chunk loads.
So a layer needs only plain `defineAsyncComponent` for a widget. `PlutoContentForm` also shows one
skeleton per field while an item loads (`pending` of `usePlutoContentItem`).

When no widget resolves, `PlutoContentField` renders a `UFormField` showing the field's `label`
and the message `No widget registered for field type "<type>".`, instead of silently rendering
nothing. A missing widget should fail visibly and legibly, not disappear.

Core ships eight widgets, under `app/components/Pluto/Content/fields/`:

| `PlutoField.type`  | Widget                | Notes                                                                                                                                                                          |
| ------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `text`, `textarea` | `PlutoFieldText`      | `UInput` for `text`. `UTextarea` for `textarea`: it grows with the text from `rows` (default 4) up to `maxRows` (default 14), then it scrolls. Both are optional on the field. |
| `slug`             | `PlutoFieldSlug`      | A plain `UInput` plus a `field.preview + modelValue` preview line. Does **not** own auto-derivation from another field — see below.                                            |
| `number`           | `PlutoFieldNumber`    | `UInputNumber`                                                                                                                                                                 |
| `boolean`          | `PlutoFieldBoolean`   | `USwitch`                                                                                                                                                                      |
| `date`             | `PlutoFieldDate`      | `UInputDate`, converting to/from `@internationalized/date`'s `CalendarDate` at its own boundary — a content item stores a plain ISO date string                                |
| `select`           | `PlutoFieldSelect`    | `USelect`, mapping `field.options` to `{ label, value }`                                                                                                                       |
| `reference`        | `PlutoFieldReference` | `UInputMenu`, populated from `field.optionsUrl` when set                                                                                                                       |

The Git CMS Markdown widget reads `PlutoTextField.editor` (`'auto' | 'visual' | 'source'`,
default `auto`) for a `richtext` field. It picks the first mode of the Visual/Source switch (see
the git-cms skill). Other widgets ignore it.

**`richtext` has no core widget, on purpose.** A layer registers it (the Git CMS, `supabase-blog`),
through its own `contentFieldWidgets` entry. `media` has the core widget, `PlutoFieldMedia`: the
picker of the core media library (see the media skill).

`PlutoFieldReference` reads its choices from `field.target` (the items of another content type,
from the generic list route; see the tags-and-categories skill) or from `field.optionsUrl` (it
fetches the URL expecting `{ data: Array<Record<string, unknown>> }` and maps each row through
`field.labelKey`/`field.valueKey`, default `'label'`/`'id'`). Both render a searchable
`UInputMenu`; `multiple` gives a list value. With neither, it renders a disabled `UInputMenu` with
a placeholder noting no options source is configured, rather than throwing.

## Revisions

A backend that keeps the saved versions of an item implements two optional adapter reads. Core
gives the routes, the capability check and the admin UI.

- `listRevisions(ctx, id, { limit, cursor })` returns `{ data, nextCursor? }`: the versions of
  one item, newest first. The first entry is the version that the item has now. A
  `PlutoContentRevision` has `id` (safe in a URL path segment), `createdAt` (ISO), `author?`
  (`name`, `login?`, `avatarUrl?`), `action?` (`create`, `update`, `publish`, `unpublish`,
  `rename`) and `message?` (shown when there is no `action`).
- `getRevision(ctx, id, revisionId)` returns the item as it was at that revision, or `null`. Its
  `_version` is the version of that revision.

| Route                                                       | Method | Calls                  |
| ----------------------------------------------------------- | ------ | ---------------------- |
| `/api/_pluto/content-revisions/[type]/[...id]?limit&cursor` | GET    | `listContentRevisions` |
| `/api/_pluto/content-revision/[type]/[revision]/[...id]`    | GET    | `getContentRevision`   |

Own base paths, because an id can hold slashes (a nested type): the revision comes before the id.
Both need `type.capabilities.write` (`authorizeContentOperation`, so the fail-open rule applies):
the history is for editors. The adapter checks its own access too. `limit` is 1 to 50 (default
20). An adapter without the two methods answers `{ supported: false, data: [] }`, and
`getContentRevision` gives 404. Tests: `test/content-handlers.test.ts` ("content revisions"),
`test/content-routes.test.ts`.

**There is no restore call.** `PlutoContentHistory` (a core `contentToolbarItems` entry for
every type, order 40) copies the fields of a revision into the form, and the user saves. So a
restore is a normal save: validation, capabilities, hooks, the publish rules, the `_version`
conflict check, and a new version that can be undone. `revisionRestoreValues` copies the stored
form fields (`restorableFields`: not virtual, not `inForm: false`), but not the slug field and not
the status field: a restore keeps the id and does not publish or unpublish. The form keeps its
own `_version`.

The component asks for the first page when an edit page opens, and shows its button only when
the backend answers `supported` with one revision or more. A save reads the list again. The
slideover lists the versions (avatar, action or message, date) with "Load more", and shows what a
restore of the selected one changes in the form (`diffRevision`): a value pair for a short value,
a line diff for a richtext or textarea field or a multi-line value (`diffLines`, an LCS with a
4 M-cell cap, then a plain replace), folded to 2 lines of context (`foldDiff`). On open it selects
the version before the current one, or the current one when the form has unsaved changes. Below
`md` the detail replaces the list, with a back button. The pure helpers are in
`shared/utils/content-revision.ts` (test: `test/content-revision.test.ts`). The texts are under
`pluto.history.*`. `diffFields(fields, current, next)` is the shared diff, and
`PlutoContentChanges` renders it for History and for the backup recovery.

The Git CMS implements both methods (see the git-cms skill, "Revisions"). `@plutocms/supabase` keeps them in
the table `pluto_content_revisions` (its content-adapter skill, "Revisions").

## Backups

`PlutoContentAdapter.backups` is optional: a server copy of the unsaved changes of the caller, one for each
user, type and item (the content-backup skill has the client side). Without it the form keeps the browser
backup only.

- `get(ctx, key)` returns the `PlutoContentBackup` of the caller or `null`. `put(ctx, key, record)` replaces it and
  returns `{ otherDevice }`: true when the replaced copy came from another `device` in the last 10 minutes.
  `remove(ctx, key)` deletes it. `key` is the item id as text, or `+new` for a new item. The adapter reads the
  caller from `ctx.event`, and each caller sees only its own copies.

| Route                                       | Method | Handler               |
| ------------------------------------------- | ------ | --------------------- |
| `/api/_pluto/content-backup/[type]?id=<id>` | GET    | `getContentBackup`    |
| same                                        | PUT    | `putContentBackup`    |
| same                                        | DELETE | `removeContentBackup` |

The id is a query, because an id can hold slashes. No `id` means a new item (`+new`). Each handler answers
`{ supported: false }` before any check when the adapter has no `backups` (the Git CMS). Then it checks the
write capability of the type, as a save does. PUT reads the raw body: over 1,000,000 characters is a 413
(`pluto.errors.backupTooLarge`), and a body that `parseBackup` refuses is a 400 (`pluto.errors.backupInvalid`).
Only the declared backup fields are kept. The origin check covers PUT and DELETE.

`createContentItem` (`+new`), `updateContentItem` (the route id, also for a rename) and `deleteContentItem` call
`removeBackupQuietly` after the adapter call worked. A removal error only warns: a backup never fails a save.
Tests: `test/content-handlers.test.ts` ("content backups"), `test/content-routes.test.ts`; the memory fixture
takes `{ backups: true }`, one map for each caller (`event.context.userId`).

## The `_version` token and id changes: for adapter authors

`PlutoContentItem` has one reserved optional key, `_version` (a string). It is an
optimistic-concurrency token.

- An adapter MAY return `_version` on `get` and `list` items.
- The form keeps the item it loaded. On save, `buildContentPayload` copies `_version` into the
  request body, unchanged. The Supabase adapter never returns it, so nothing changes there.
- An adapter that uses the token compares it with the stored one on update. When they differ,
  it throws `createPlutoError({ statusCode: 409, key: 'pluto.errors.conflict', ... })`. The
  form tells this 409 from a taken slug (`pluto.github.errors.slugTaken`) with `errorKey(error)`
  (`internal/error-text.ts`). On the conflict key it writes the backup now and shows a warning
  alert, "Someone saved this item after you opened it. Your changes are safe.", with the button
  "Load the latest and keep my changes" (see the [content backup](../content-backup/SKILL.md)). Any
  other 409 keeps the error toast.
- An adapter that does not use the token ignores the key.
- Do not declare a field named `_version`.

The file adapter of the CMS also returns the reserved key `_frontmatter` on `get` (not on `list`): a
copy of the whole frontmatter of the file, after the `files.frontmatter.read` hook, with the keys that
no field maps. The form never sends it back (`buildContentPayload` copies declared fields and `_version`
only). Do not declare a field named `_frontmatter`.

An adapter can also change the `id` of an item on update, for example a file-based adapter that
renames a file when the slug changes. In that case, return the item with its new `id`. In edit
mode, when the saved `id` differs from the current one, `PlutoContentForm` navigates to the new
edit path (from `editPath`) with `replace: true`. The generated page `[id].vue` sets
`:key="route.params.id"` on the form, so the form mounts again and `usePlutoContentItem` loads
the new id. A layer with its own edit page must do the same, because `usePlutoContentItem`
reads `id` only once.

`buildContentPayload(type, item, statusOverride?)` is in
`app/composables/internal/content-payload.ts`. It is a pure function, so Vitest tests it
directly.

## `PlutoContentList` and `PlutoContentForm`

`PlutoContentList` renders a content type's items: a desktop `UTable` and a mobile `UCard` grid
(the same breakpoint pattern `supabase-blog/app/pages/admin/posts.vue` already used), an "Add
`<labelPlural>`" button, and a delete-confirm modal built from core's own `Modal`/`ModalHeader`/
`ModalContent`/`ModalFooter` — never `UModal` directly, matching this repo's established pattern.

Above the rows: a search box (300 ms after the last key), a Status filter for a type with a
workflow, and one filter for each field of `listFilterFields(type)`
(`PlutoContentListFilter`: a `USelectMenu` whose first item "All" clears it; a reference filter
loads its target with `usePlutoReferenceOptions` and has a search; a set filter shows
"<label>: <value>" with a highlight). "Clear the filters" removes the search, the status and the
filters, and keeps the sort. The header of a sortable column is a button: ascending, descending,
then the default sort. The state is in the route query, in the keys of the list route (`search`,
`status`, `filter[<field>]`, `sort`), so a reload, a link and the back button keep it; the page
parses it with `parseAdminListQuery` and drops a bad value. A narrowed list with no row shows "No
<labelPlural> match" with "Clear the filters". An empty type shows no search and no filter.

`PlutoContentForm` renders a two-column form (fields with `region !== 'side'` in the wide column,
`region: 'side'` in the sidebar, both sorted by `order`), a Save button, and client-side
validation through `validateContentPayload` before it ever calls `save()` — the server validates
again regardless (wave 2), so this is a UX nicety, not the enforcement point. On a successful
create, it shows a success toast and navigates to the new item's edit URL; on a successful update,
it shows a success toast and stays put.

In edit mode, the toolbar title (every layout has the same toolbar and no body H1, see the
admin-view-chrome skill) and the browser tab title show the value of the type's `titleField`. While the item loads, or when the title is empty, they show "Edit <type>". If the
item fetch fails (a 404 or a network error), the form shows an empty state (`UEmpty`) with a
"Try again" button (no button on a 404), renders no fields, and hides Save, Publish and the
overflow menu. Typing in a field never reaches this state: only `loadError` triggers it.

### Formatting a list cell

A field can set `listFormat?: (value, item) => string`. The generic list calls it for the desktop
table cell and for the mobile card of every field with `inList`. It changes only the list. The
form and the API keep the raw value. Use it for a value that needs a unit or a locale, such as a
price in cents:

```ts
{ name: 'price', type: 'number', label: 'Price', inList: true,
  listFormat: (value) => formatProductPrice(value as number) }
```

The function must be pure and must not read browser globals, because content type definitions
are shared with the server. If it throws, the list shows the raw value. `formatListValue(field,
item)` in `shared/utils/content-list.ts` is the helper that runs it. A field with no `listFormat`
shows the raw value as text.

### Slugs

`slugifyTitle(value)` (`shared/utils/content-slug.ts`, auto-imported) makes a slug from a title:
it strips accents ("Pão de Mel" becomes `pao-de-mel`), lowercases, joins words with single
dashes, and cuts at 100 characters. The form and the Git CMS both use it.

Both components gate write/delete visibility with the same rule:

```ts
const canWrite = computed(
  () => !type.capabilities?.write || can(type.capabilities.write)
)
```

**Never call `can('')` as a stand-in for "no capability declared."** When a content type
declares no capability for an operation, that operation is open to anyone who can reach the
page — the UI must reflect that directly, the same rule wave 2 already enforces server-side (see
"Capability enforcement: write and delete" above).

### The slug bug this wave deliberately does not repeat

`supabase-blog/app/components/PostForm.vue` re-derives its slug from the title on every
keystroke, unconditionally — including while editing an already-published, already-shared post,
silently changing a live URL out from under it. `PlutoContentForm`'s slug auto-derivation stops
the moment either:

1. The form is in edit mode (an `id` prop is present) — an existing entry's slug is presumed
   already meaningful, and never auto-changes without the user directly touching the slug field.
2. The user has typed into the slug field directly, even while creating a new entry — tracked by
   a local `slugTouched` flag, flipped the moment the slug field's own `update:modelValue` fires.

If you are comparing this against `PostForm.vue` later: this is the fix, not a regression from
copying its watcher too literally.

## Nav and pages derivation for auto-routed content types

`usePlutoAdminNav()` synthesizes one `PlutoNavItem` per content type where
`type.autoRoutes !== false`, alongside the registry's own `nav` bucket:

```ts
{
  id: `content:${type.name}`,
  order: type.navOrder ?? 100,
  label: type.labelPlural,
  icon: type.icon,
  to: type.basePath ?? `/admin/content/${type.name}`,
  enabled: () => !type.capabilities?.read || can(type.capabilities.read),
  children: [/* "All <labelPlural>" and "Create new <label>" */],
}
```

**No capability declared means always visible** — stated here as plainly as the equivalent
server-side rule already is above: when `type.capabilities.read` is unset, the nav entry shows
unconditionally; when it is set, `can(...)` decides. This is the same rule `PlutoContentList`'s
and `PlutoContentForm`'s own `canWrite`/`canDelete` follow, applied to nav visibility instead.

A type with `navGroup` joins a group item (see "Nav groups" in the extension-registry skill) when
the group has two or more visible types. The item has no `to`, and its children are the list pages
of the types. A group with one visible type, and a type with an unknown group, keep the item above.

`PlutoEntry.enabled` applies to both sources: the registry filters its own entries, and
`usePlutoAdminNav` filters the merged list again with `enabled?.() ?? true`.

`usePlutoAdminPages()` synthesizes two `PlutoAdminPage` entries per auto-routed content type — a
list page (`path: basePath, title: labelPlural`) and a "new" page (`path: `${basePath}/new``,
`parent: content:<name>`, matching the nav entry's id). The existing `current` lookup
(`items.value.find(page => page.path === route.path)`) needs no change: these are plain objects
with a matching `path`, same as every other registered page.

## `newPath`/`editPath` — for a layer whose URLs are not symmetric

`PlutoContentList` and `PlutoContentForm` build every link they need from one `basePath`: the
"add new" button is `${basePath}/new`, a row's edit link is `${basePath}/${id}`, and a
post-create redirect goes to that same edit link. This is not only for `autoRoutes`-derived
nav/pages — it is used unconditionally, including with `autoRoutes: false`.

A layer adopting this system for an _existing_ content type does not get to choose new URLs —
that would be a breaking change for an already-deployed site, the one thing this whole project
holds itself to never doing. `supabase-blog`'s `posts` is the first case that actually hit this:
its create URL is `/admin/post/new` (singular) but its edit URL is `/admin/post/edit/:id`
(singular, with an extra literal `edit` segment) — no single `basePath` string produces both.

`newPath?: string` and `editPath?: (id: string | number) => string` exist for exactly this.
Leave both unset and the defaults above apply unchanged. Set `newPath` to the literal create URL,
and `editPath` to a function returning the literal edit URL for a given id, when a layer's real
URLs do not fit the `basePath` pattern:

```ts
basePath: '/admin/posts',
newPath: '/admin/post/new',
editPath: (id) => `/admin/post/edit/${id}`,
```

The default edit link is `${basePath}/${contentIdPath(id)}`. `contentIdPath`
(`shared/utils/content-id.ts`, auto-imported on the server and the client) encodes each segment of
the id and keeps the `/` between them, so a nested id (`1.start/2.install`) stays readable and is
not `%2F`. The list links and `usePlutoContentItem` use it too. The item page and the item API
routes are catch-alls (`pages/admin/content/[type]/[...id].vue`, `[...id].get|patch|delete.ts`).
The page joins the array param with `/`. The routes read
`getRouterParam(event, 'id', { decode: true })`. Use `contentIdPath` in your own `editPath` when
ids can hold slashes.

`basePath` itself still matters even when both overrides are set — it is still what
`autoRoutes !== false` derives nav/pages from, and still the fallback either override defers to
when unset.

`shared/utils/content-admin-paths.ts` (auto-imported) has the same rules as pure functions:
`contentTypeBasePath(type)`, `contentTypeNewPath(type)` and `contentTypeEditPath(type, id)`. Use
them for a new link instead of building the path again.

## `adminBar` — buttons in the admin bar

`adminBar?: boolean | { new?: boolean, edit?: boolean }` asks core for buttons in the admin bar.
`true` gives both. Unset gives none, so a layer with its own bar actions does not get doubles.
`contentTypeAdminBar(type)` normalizes it.

- `new`: "New <type>" on every page where the bar shows, to `contentTypeNewPath(type)`.
- `edit`: "Edit <type>" on a public page that calls `usePlutoEditLink(type, id)`.

The `write` capability of the type decides, like the form. See "Content buttons" in the
admin-shell skill. With two or more types, the "New" buttons become one "New" menu, grouped by
`navGroup`.

## `navGroup` — one sidebar item for related types

`navGroup?: string` is the id of a group in the registry bucket `navGroups` (`'pluto:pages'`, or the bare
`'pages'`). The sidebar shows the types of a group as one item, and the admin bar lists them in
one "New" menu. Unset gives the type its own item. `navOrder` still sets the order of an ungrouped
item. The group has its own `order`.

## `form`, `capabilities.publish`, and the publish workflow

A later wave (see the [admin view chrome](../admin-view-chrome/SKILL.md) skill) added two more
optional fields to `PlutoContentType`, and one more field to `PlutoContentTypeCapabilities`:

- `form?: { layout?, canvasField?, aside?, asideCollapsed?, width? }` — layout knobs for the generic
  form (`PlutoContentForm`), for example a minimal-chrome `layout: 'focus'` for a writing surface,
  or `layout: 'canvas'` for a full-height field with side panels.
- `previewUrl?: (item) => string | undefined` — the public URL of an item. The form toolbar shows a
  "View" link when it returns a value.
- `liveOnSave?: boolean` — the public site shows a save at once, because it reads this type at run
  time (a layer that serves from the content store). A deploy may still run. The build indicator of the
  edit form (Git CMS) then shows "Live" right after a save, a small spinner by the Info button while
  the static build runs, and a warning in the popover when that build fails. Default false: the indicator
  shows "Publishing…" until the build passes.
- `capabilities.publish?: string` — the capability required to publish. Falls back to
  `capabilities.write` when unset, the same "no capability declared means open" rule every other
  capability check here already follows.

A content type that declares `status` (see "Declaring a content type" above) gets a
draft/published workflow in the generic form for free: Save/Publish/Update buttons, an Unpublish
action, and a status badge. `mapColumnsToFields` reads the status column back into `item.status`
symmetrically with the write side, so the form always knows the current status. Full detail —
the button logic, the payload shape, the `contentActions` registry bucket a layer uses to add its
own form buttons — lives in the admin-view-chrome skill, not duplicated here.

## Translating the labels of a content type

A content type keeps English literals in its declaration (`label`, `labelPlural`, field labels,
and so on). Core looks up convention keys in the i18n system (see the i18n skill) and falls back
to the literal when a key does not exist. The convention keys, under the namespace
`content.<name>`:

- `content.<name>.label`, `content.<name>.labelPlural`, `content.<name>.new`
- `content.<name>.fields.<field>.label`, `.description`, `.placeholder`
- `content.<name>.fields.<field>.options.<value>`
- `content.<name>.status.<value>`

The layer that declares the type owns these keys, in its own `i18n/locales/<code>.json`. Core
declares no type, so core's own locale files have no `content` namespace.

The keys are wired. `usePlutoContentText(type)` resolves them, with the English literal as the
fallback, and these places use it: the list (title, columns, empty states, "New <label>"), the
form (title, field text, status badge, validation messages, toasts), the dashboard tiles and the
activity chart, the quick actions, the command palette, and the nav and page entries that content
types create. `PlutoContentField` passes a translated copy of the field to the widget, so a
third-party widget gets the translated label with no change. Server code and anything that reads
`type.label` keeps English. See the i18n skill.

## The form context for widgets

A field widget can read the state of its form with `usePlutoContentForm()`: the item, `dirty`,
`saving`, `errorsByField`, `onSaved(callback)` and `onFlush(callback)`. A widget that holds edits
outside its `modelValue` registers `onFlush`: the form runs it before a save and before a backup
write. A canvas widget adds panels with
`PlutoContentCanvasPanel`. The widget contract above does not change. See the admin-view-chrome
skill, "The form context" and "The canvas layout".

`PlutoContentType.form.backup?: boolean` (default `true`) turns off the browser backup of the
unsaved changes for the type. Set it to `false` for a type whose text must not stay in the
browser. See the [content backup](../content-backup/SKILL.md) skill.

## Nested ids and `compareContentIds`

`PlutoContentType.files` (`nested`, `exclude`, `frontmatter.read|write`) is read by the file
adapters only (see the git-cms skill). A nested type has ids with slashes.
`compareContentIds(a, b)` (shared util) is an `Array.sort` comparator for such ids. In each
segment, `index` comes first, then a numeric prefix (`2.name`) as a number, then the name.

## Known limits, out of scope for this pass

- No real (non-memory) `PlutoContentAdapter` implementation. `@plutocms/supabase`'s job, a
  separate repo, a later wave. `test/fixtures/memory-content-adapter.ts` exists only for this
  repo's own tests — it is never registered in the real app.
- No per-layer adoption. `supabase-blog` and `supabase-shop` still run their own hand-written
  admin pages (`PostForm.vue` and so on) — switching them over to `PlutoContentList`/
  `PlutoContentForm` is a later wave's job, once a real adapter exists for them to declare
  content types against.
- No query-string support for `filter` or a custom `sort` override on the generic list route.
  `PlutoContentQuery` has room for both; this wave only wires `limit`, `offset`, and `search`
  from the query string, with sort always coming from `type.defaultSort`.
- `PlutoContentI18n` (`PlutoContentType.i18n`) is still a reserved, unused field. It is about
  translating **stored content** (one row in many languages). That is a different concern from
  translating the admin UI text, which the i18n skill covers. Nothing reads or acts on it. Only
  `strategy: 'row'` will ever be valid, so declaring the shape now avoids a breaking rename later.
