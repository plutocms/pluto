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
- `shared/types/media.ts` — `PlutoMediaAdapter`, the media-backend contract.
- `shared/utils/content.ts` — `defineContentType(type)`.
- `shared/utils/content-validate.ts` — `validateContentPayload(type, payload, options)`.
- `shared/utils/content-map.ts` — `fieldColumn`, `mapFieldsToColumns`, `mapColumnsToFields`.
- Three new fields on `PlutoExtension`: `contentTypes`, `contentFieldWidgets`, `mediaAdapters`.
- Three new registry buckets on `PlutoRegistry`, matching those fields.
- `app/composables/pluto-content-types.ts` — `usePlutoContentTypes()`.
- `app/composables/pluto-content-fields.ts` — `usePlutoContentFieldWidget(field)`.
- `app/composables/pluto-media-adapter.ts` — `usePlutoMediaAdapter()`.
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
  alongside core's existing Home/Settings nav anchors.
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
    { name: 'title', type: 'text', label: 'Title', required: true, inList: true },
    { name: 'body', type: 'richtext', label: 'Body' },
    { name: 'status', type: 'select', label: 'Status', options: [
      { label: 'Draft', value: 'draft' },
      { label: 'Published', value: 'published' },
    ] },
  ],
  status: {
    values: [{ label: 'Draft', value: 'draft' }, { label: 'Published', value: 'published' }],
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
(value must match an option), and text-family `maxLength`. A `date`, `reference`, or `media`
field only gets the `required` check in this wave.

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

## `usePlutoContentFieldWidget(field)`

Resolves the component that should render one field in the generic content form (a later wave):

```ts
const component = usePlutoContentFieldWidget(field) // ComputedRef<Component | undefined>
```

Resolution order: an exact `field.widget` name match first, then the last-registered
`PlutoContentFieldWidget` whose `fieldType` matches `field.type`, else `undefined`. This wave
adds no fallback placeholder component — deciding what to show when nothing resolves is later,
UI-wave work.

## `usePlutoMediaAdapter()`

The registered media adapter:

```ts
const { adapter } = usePlutoMediaAdapter() // ComputedRef<PlutoMediaAdapter | undefined>
```

Exactly one adapter is meaningful per app. When more than one layer registers one, **the
last-registered entry wins** — the same "last wins" rule `usePlutoSettings()` and
`usePlutoPermissions()` already use to resolve their driver. `PlutoMediaAdapter` itself is only a
type in this wave: a storage layer has nothing to register against yet (no built-in media picker
UI, no `media` field widget rendering). It exists now so the registry bucket, and a later wave's
picker UI, have a stable contract to build against.

## The server-side registry

`server/utils/pluto-content.ts` holds two things: a `Map<string, PlutoContentType>` (keyed by
`type.name`) and a single `PlutoContentAdapter | undefined` variable — both plain module-scope
state:

```ts
registerContentType(type) // adds or overwrites one content type, by type.name
getContentType(name) // PlutoContentType | undefined
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

Five routes, all under the `/api/_pluto/content/` prefix — the leading underscore marks these as
core-internal/generic, distinct from a layer's own hand-written routes (`/api/post/*`,
`/api/product/*`) and avoids any collision with them:

| Route | Method | Calls |
|---|---|---|
| `/api/_pluto/content/[type]` | GET | `listContentItems` |
| `/api/_pluto/content/[type]` | POST | `createContentItem` |
| `/api/_pluto/content/[type]/[id]` | GET | `getContentItem` |
| `/api/_pluto/content/[type]/[id]` | PATCH | `updateContentItem` |
| `/api/_pluto/content/[type]/[id]` | DELETE | `deleteContentItem` |

Each route file is a thin wrapper: resolve `type` from the `[type]` route param through
`requireContentType`, build a `PlutoContentContext`, call the matching handler function from
`server/utils/pluto-content-handlers.ts`, and return its result. The real logic lives in that
handlers file, as plain exported async functions, so it can be unit-tested by calling it
directly — no live Nitro server, no `@nuxt/test-utils` — the same way this workspace already
tests everything else. The list route accepts `limit`, `offset`, and `search` as query params;
sorting always comes from `type.defaultSort`, never from the query string, in this wave.

## Capability enforcement: read is never checked here

`type.capabilities.read` is **never enforced by these generic routes.** Read that twice — it is
the single easiest thing to get wrong here.

`read` gates the admin nav/list *UI* in a later wave, nothing in this wave. The generic list and
get routes never throw 401/403 for a missing `read` capability, and never call
`adapter.authorize` for list or get, under any circumstance. The reason: for a type like `posts`,
"read" is not all-or-nothing — an anonymous visitor can read *published* posts, and only reading
*drafts* needs a capability. That distinction already lives in the adapter's backing store (RLS,
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
const { items, total, pending, error, refresh, remove } = usePlutoContentList('post')
await remove(id) // DELETEs, then refreshes

const { item, pending, error, refresh, save, remove } = usePlutoContentItem('post', () => route.params.id)
await save(payload) // POSTs when id is undefined, PATCHes when id is defined
```

`id` is read once, with `toValue`, at composable-creation time — not watched for later changes.
Each generated page mounts fresh on every route change, so there is no case in this wave where
`id` changes under a still-mounted `PlutoContentForm`.

## `PlutoContentField` and the eight built-in widgets

`PlutoContentField.vue` resolves a field's widget through `usePlutoContentFieldWidget(field)`
(wave 1) and renders it, passing `field`/`modelValue`/`disabled` through and re-emitting
`update:modelValue` unchanged. It never needs to know which concrete widget it dispatched to —
every widget shares that same three-prop contract.

When no widget resolves, `PlutoContentField` renders a `UFormField` showing the field's `label`
and the message `No widget registered for field type "<type>".`, instead of silently rendering
nothing. A missing widget should fail visibly and legibly, not disappear.

Core ships eight widgets, under `app/components/Pluto/Content/fields/`:

| `PlutoField.type` | Widget | Notes |
|---|---|---|
| `text`, `textarea` | `PlutoFieldText` | `UInput` for `text`, `UTextarea` for `textarea` |
| `slug` | `PlutoFieldSlug` | A plain `UInput` plus a `field.preview + modelValue` preview line. Does **not** own auto-derivation from another field — see below. |
| `number` | `PlutoFieldNumber` | `UInputNumber` |
| `boolean` | `PlutoFieldBoolean` | `USwitch` |
| `date` | `PlutoFieldDate` | `UInputDate`, converting to/from `@internationalized/date`'s `CalendarDate` at its own boundary — a content item stores a plain ISO date string |
| `select` | `PlutoFieldSelect` | `USelect`, mapping `field.options` to `{ label, value }` |
| `reference` | `PlutoFieldReference` | `UInputMenu`, populated from `field.optionsUrl` when set |

**`richtext` and `media` have no core widget, on purpose.** Core has no real rich-text editor and
no real file picker to offer for either — a layer registers those (`supabase-blog` registers
`richtext`, `supabase-storage` registers `media`), through its own `contentFieldWidgets` entries,
the same registration mechanism core's own eight widgets use.

`PlutoFieldReference` only resolves `field.optionsUrl` in this wave. When it's set, the widget
fetches it expecting `{ data: Array<Record<string, unknown>> }`, maps each row through
`field.labelKey`/`field.valueKey` (default `'label'`/`'id'`), and renders a searchable
`UInputMenu`. When it's unset (for example `field.target` names a content type instead), it
renders a disabled `UInputMenu` with a placeholder noting no options source is configured,
rather than throwing — resolving `field.target` against another content type's own list endpoint
is later work.

## `PlutoContentList` and `PlutoContentForm`

`PlutoContentList` renders a content type's items: a desktop `UTable` and a mobile `UCard` grid
(the same breakpoint pattern `supabase-blog/app/pages/admin/posts.vue` already used), an "Add
`<labelPlural>`" button, and a delete-confirm modal built from core's own `Modal`/`ModalHeader`/
`ModalContent`/`ModalFooter` — never `UModal` directly, matching this repo's established pattern.

`PlutoContentForm` renders a two-column form (fields with `region !== 'side'` in the wide column,
`region: 'side'` in the sidebar, both sorted by `order`), a Save button, and client-side
validation through `validateContentPayload` before it ever calls `save()` — the server validates
again regardless (wave 2), so this is a UX nicety, not the enforcement point. On a successful
create, it navigates to the new item's edit URL; on a successful update, it shows a success toast
and stays put.

Both components gate write/delete visibility with the same rule:

```ts
const canWrite = computed(() => !type.capabilities?.write || can(type.capabilities.write))
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
`type.autoRoutes !== false`, alongside its two existing sources (the registry's own `nav`
bucket, and the legacy `@plutocms/utils` sidebar bridge):

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

This wave also fixed a latent gap while adding this: `PlutoEntry.enabled` was already read and
enforced for the registry's own `nav` bucket (inside `createOwnedRegistry`), but the merged nav
computed never applied it to the legacy-bridge source. It now applies the same `enabled?.() ??
true` filter uniformly across all three sources.

`usePlutoAdminPages()` synthesizes two `PlutoAdminPage` entries per auto-routed content type — a
list page (`path: basePath, title: labelPlural`) and a "new" page (`path: `${basePath}/new``,
`parent: content:<name>`, matching the nav entry's id). The existing `current` lookup
(`items.value.find(page => page.path === route.path)`) needs no change: these are plain objects
with a matching `path`, same as every other registered page.

## Known limits, out of scope for this pass

- No real (non-memory) `PlutoContentAdapter` implementation. `@plutocms/supabase`'s job, a
  separate repo, a later wave. `test/fixtures/memory-content-adapter.ts` exists only for this
  repo's own tests — it is never registered in the real app.
- No per-layer adoption. `supabase-blog` and `supabase-shop` still run their own hand-written
  admin pages (`PostForm.vue` and so on) — switching them over to `PlutoContentList`/
  `PlutoContentForm` is a later wave's job, once a real adapter exists for them to declare
  content types against.
- `PlutoFieldReference` does not resolve `field.target` (a same-app content-type reference with
  no `optionsUrl`) — it needs the generic list endpoint of *another* content type, which is later
  work. It renders the documented disabled placeholder instead.
- No query-string support for `filter` or a custom `sort` override on the generic list route.
  `PlutoContentQuery` has room for both; this wave only wires `limit`, `offset`, and `search`
  from the query string, with sort always coming from `type.defaultSort`.
- No i18n. `PlutoContentI18n` exists on `PlutoContentType.i18n` as a reserved, unused field.
  Nothing reads or acts on it. Only `strategy: 'row'` will ever be valid, so declaring the shape
  now avoids a breaking rename later.
- No built-in media adapter and no media picker UI. `PlutoMediaAdapter` is a contract only, and
  the `media` field type still has no core widget (see above).
