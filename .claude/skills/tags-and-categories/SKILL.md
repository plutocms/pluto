# Tags and categories

Core has no taxonomy system. A term (a tag, a category) is a content type. Core adds a
many-to-many `reference` field and the pieces around it: validation, the public API, filters, and
the Git CMS term types. A term page is the public API with a filter. The plan is
`.claude/plan/tags-and-categories.md` of the workspace.

This skill covers the data path and the admin UI of core: the widget, the list cell and the preview
page. The Supabase tables are in the `@plutocms/supabase-blog` repo.

It builds on the [content model](../content-model/SKILL.md) and the [Git CMS](../git-cms/SKILL.md).

## The field

```ts
{ name: 'tags', type: 'reference', label: 'Tags', target: 'tag', multiple: true, create: true }
```

- `target`: the name of the referenced content type. The stored value is the **id** of an item of
  that type: one id, or a list of ids in order (`multiple`). In the Git CMS the id is the slug (the
  file name). In Supabase it is the number id.
- `create`: the admin widget can create a new item of `target` inline (needs `target`; the widget
  shows the option only with the write capability of the target).
- `optionsUrl` stays for a reference that is not a content type. `defineContentType` warns in dev
  for a reference with neither `target` nor `optionsUrl`, and for `create` without `target`.
- `shared/utils/content-reference.ts`: `referenceValue(value)` (the ids of a value, numbers stay
  numbers), `referenceFieldIds(value)` (as text), `isTargetReference(field)`,
  `referenceFieldsTo(type, target)`. Like `mediaFieldIds`, they drop empty and non-id entries.

### Validation

`validateContentPayload` has the code `reference` (`pluto.validation.reference`): for a `multiple`
field the value must be a list of text or number ids, else one id. An empty text is empty.
`[]` counts as empty for `required`. This also holds for a `multiple` `media` field: breaking
change, an empty list now fails `required`.

## The public API

- **Expansion** (`server/utils/pluto-reference-public.ts`, `expandPublicReferences`). `toPublicData`
  calls it after `expandPublicMedia`. For each public `reference` field with a `target` whose
  type is public, core puts `{ id, label, slug? }` in place of the id: a list for `multiple`, else
  one object or `null`. `label` is the title field of the target; `slug` is set when the target has
  a slug field. An id with no published item is dropped. A field with no value gives `[]` or `null`.
  A private or unregistered target keeps the ids. Core reads each target once for the batch of an
  answer: `adapter.list(target, { ids, limit, includeUnpublished: false })`, cached by the `batch`
  array. Core matches the ids again, so an adapter that ignores `query.ids` still works. The shape
  is `PlutoPublicReference` (`shared/types/public-api.ts`). `adapter.toPublic` and `hooks.toPublic`
  run after it and can change the result. A field with `publicFields` adds more fields of the
  target to each reference (an author avatar and bio): see the [authors](../authors/SKILL.md) skill.
- **Filter** (`resolveReferenceFilters`). `filter[tags]=<id or slug>` on a `target` reference: core
  does one `adapter.get` on the target type and filters by the id. A value with no published item
  gives an empty list (the surround route answers 404). The adapter filter on a list value
  matches when the list has the value (`PlutoContentQuery.filters`).
- **`PlutoContentQuery.ids`**: only the items with these ids. An empty list gives no item. A new
  adapter duty (the contract of the adapter is unchanged: core matches the ids again).
- **Static** (`queryPublicIndex`): a list value matches when one entry matches; an expanded object
  matches by its `id` or its `slug`. So `filter[tags]=<slug>` works on a static site too.

## The Git CMS term types

`modules/pluto-github/runtime/shared/term-types.ts`: `plutoGithubTagType` (`tag`, `content/tags/`,
`lucide:tag`) and `plutoGithubCategoryType` (`category`, `content/categories/`, `lucide:folder`).
The module registers them with `post` when `postType` is on, on the server (`github-setup.ts`) and
on the client (`pluto-github.ts`).

- Fields `title` (label "Name", required, in the list), `slug` (from `title`, in the list) and
  `description`. No status, no body. Default sort `title` ascending. `api: { public: true }`,
  `liveOnSave`. `previewUrl` is `/tags/<slug>` or `/categories/<slug>` (the core blog template has
  no term page: change it with `extendContentTypes`).
- Capabilities: `write` and `delete` are `terms:manage` (not the post keys). A push user gets it
  with the other keys of the registered types; admin and maintain have `*`. The client extension
  declares it (`pluto.github.capabilities.manageTerms`).
- The post type has the fields `categories` (`target: 'category'`, in the list) and `tags`
  (`target: 'tag'`), both `multiple`, `create`, in the side region. In a file:

  ```yaml
  tags:
    - hiking
    - winter
  ```

- A term file is `content/tags/hiking.md` with a `title`. A post with an id that has no term file
  shows no tag in the public answer.
- **Rename and delete.** Renaming a term (a new slug) or deleting it rewrites the posts that
  reference it, drafts too, in the same commit as the term change (see the git-cms skill,
  "Adapter"). The commit message is `content(tag): rename "a" -> "b" (3 references)`. A post that
  changes while the commit runs gives 409.
- **Empty list.** An empty list leaves the frontmatter (the key is removed), for every field.

## The admin UI

- **`usePlutoReferenceOptions(target)`** (`app/composables/pluto-reference-options.ts`; pure parts in
  `internal/reference-options.ts`, tested in `test/reference-options.test.ts`). Returns
  `{ options, byId, pending, error, refresh, ensure, create }`. It reads the items of the target
  from the generic admin route (`limit=1000`) and shares them by target in `useState`, with one
  request in flight per target. `ensure()` reads unless the last read is under 10 seconds old.
  `create(title)` returns an option with the same label or slug with no request, else POSTs
  `{ <titleField>: title, <slugField>: slugifyTitle(title) }`; on 409 it reads again and returns the
  match.
- **`PlutoFieldReference.vue`**. A `UInputMenu` with `value-key`; `multiple` gives chips and a list
  value, else one id. A `target` field reads `usePlutoReferenceOptions`; an `optionsUrl` field reads
  its URL (both support `multiple`). An id with no option shows the id as its text. The "Create
  “…”" entry shows only when the field has `create` and the user has the write capability of the
  target type (`terms:manage` for the term types). A failed create shows a toast. The icon of the
  target type leads the input. When the target type has an image field (`referenceImageField`: its
  first `media` field of one image, the avatar of an author), each option has an avatar: the image
  (the option carries its media id, `image`; the widget loads the records in one `usePlutoMedia().get`
  call), else the initials. The chips show it too (`#tags-item-text`: a chip holds the id, so the
  widget looks up the option).
- **`PlutoContentReferenceCell.vue`**. In the list table and the mobile card, a `target` reference
  shows up to three badges (the labels, in the order of the stored ids), then "+N".
- **Preview.** `post-preview.vue` reads each target of `previewReferenceTargets(type)` and passes the
  map to `toPreviewItem`. The default `PlutoPostPreview` shows the references as chips under the
  body. An app preview component reads `item.tags` and `item.categories` as `PlutoPublicReference[]`.
- **i18n.** `pluto.fields.reference.{create,createFailed,placeholder,empty}`, and the convention keys
  `content.tag`, `content.category` and `content.post.fields.{tags,categories}.label`.

## Site composables

`useTags`, `useTag`, `useCategories`, `useCategory` (`app/composables/pluto-site-content.ts`,
`definePlutoContent` with the sort `title`). Types `PlutoTerm` and `PlutoPublicReference`;
`PlutoPostSummary` has `tags?` and `categories?`. The posts of a term:

```ts
const { tag } = await useTag(() => String(route.params.slug))
const { posts } = await usePosts({ filter: { tags: tag.value.slug } })
```

## Preview

`toPreviewItem(type, item, html, media, references?)` (`shared/utils/content-preview.ts`) expands
the `target` references of a form item like the public API. `references` is a map from the
target type name to a map from id to `PlutoPublicReference`. `previewReferenceTargets(type)` gives
the target names and `previewReferenceIds(type, item, target)` the ids to load. The preview
page uses the targets (see "The admin UI").

## Limits

- No hierarchy of categories. A category is flat.
- A rename in the Git CMS reads every file of each referencing type: on a large blog it writes many
  files in one commit.
- The admin widget loads up to 1000 terms. A longer list needs a server search.

## Files and tests

Core: `app/components/Pluto/Content/fields/PlutoFieldReference.vue`,
`app/components/Pluto/Content/PlutoContentReferenceCell.vue`, `app/composables/pluto-reference-options.ts`,
`shared/utils/content-reference.ts`, `server/utils/pluto-reference-public.ts`,
`modules/pluto-github/runtime/shared/term-types.ts`, `modules/pluto-github/runtime/server/adapter.ts`.
Tests: `test/reference-options.test.ts`, `test/content-reference.test.ts`, `content-validate`, `content-define`, `public-index`,
`reference-public`, `github-references`, `github-wiring`, `github-push-capabilities`,
`content-preview` and `site-content-composables`.
