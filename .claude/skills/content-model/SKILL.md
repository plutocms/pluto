# Content model

This feature lets a layer declare a content type once — its fields, its storage table, its
publish workflow — as one typed contract. A later wave reads that contract to generate a server
adapter and an admin UI. This is Wave 1: types, validation, mapping helpers, registry wiring,
and the three consumer composables. **No server registry, no server routes, and no generated UI
exist yet.** Those are later waves. This wave changes nothing a real site's visitors or editors
can see.

It extends the [extension registry](../extension-registry/SKILL.md) and builds on the same
pattern as [permissions](../permissions/SKILL.md). Read both first. This feature adds:

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

## Known limits, out of scope for this pass

- No server-side content-type registry, no server routes, no Nitro plugin. A later wave in this
  same repo adds those, alongside a `PlutoContentAdapter` type this wave deliberately does not
  define.
- No generated admin UI — no `PlutoContentList`, `PlutoContentForm`, or field widget components.
  `autoRoutes` and `basePath` on `PlutoContentType` are declared for that later wave to read;
  nothing reads them yet.
- No i18n. `PlutoContentI18n` exists on `PlutoContentType.i18n` as a reserved, unused field.
  Nothing reads or acts on it. Only `strategy: 'row'` will ever be valid, so declaring the shape
  now avoids a breaking rename later.
- No built-in media adapter and no media picker UI. `PlutoMediaAdapter` is a contract only.
