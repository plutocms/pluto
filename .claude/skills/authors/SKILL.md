# Authors

A post has one or more authors. An author is a public content item (`author` type): a name, a
slug, a bio and an avatar. It is not a sign-in user, and it has no link to one: no user data
(email, role) goes to the public site. Guest authors and pen names are normal authors. The plan is
`.claude/plan/author-bylines.md` of the workspace.

It builds on the [tags-and-categories](../tags-and-categories/SKILL.md) skill (the `reference`
field with a `target`) and the [content model](../content-model/SKILL.md).

## The author type

- Git CMS: `plutoGithubAuthorType` (`modules/pluto-github/runtime/shared/author-type.ts`). The
  file is `content/authors/<slug>.md`, frontmatter only (`name`, `bio`, `avatar`, the
  timestamps). The slug (the file name) is the id. Registered with `post` when `postType` is on, on
  the server (`registerGithubContent`) and the client (the `pluto-github` plugin).
- Supabase: `@plutocms/supabase-blog` has its own `author` type over the `authors` table (see that
  repo).
- Fields: `name` (title field), `slug` (from `name`, preview `/authors/`), `bio` (`textarea`),
  `avatar` (`media`, images only). No status: an author is public once saved. `api.public`,
  default sort `name` ascending, `previewUrl` `/authors/<slug>` (change it with
  `extendContentTypes` when the site uses another path).
- Capability: `authors:manage` writes and deletes an author (label
  `pluto.github.capabilities.manageAuthors`). A Git push user gets it. The inline create of the
  post widget shows only with it.

## The post field

`authors` on the post: a `reference` field with `target: 'author'`, `multiple: true`,
`create: true`, `remember: true` and `publicFields: ['avatar', 'bio']`, in the side region. The
order of the list is the byline order. Git: the frontmatter key `authors: [<slug>, ...]`. A rename
of an author rewrites the posts, and a delete removes the slug from them, in the same commit (the
generic rewrite of the tags-and-categories skill; the key goes when the list ends empty).

## `publicFields`

`PlutoReferenceField.publicFields` puts more fields of the target item in each public reference:
`{ id, label, slug, avatar, bio }`. In `server/utils/pluto-reference-public.ts`:

- `loadReferences` collects the union of the `publicFields` of the fields of the type that point
  to the target, keeps those values of each published target item, and runs `expandPublicMedia`
  on them with the target items as the batch: one `list` and one media read for an answer.
- Each field takes only its own names. A name counts when the target field is public (stored, and
  in `api.fields` when that is set). `id`, `label` and `slug` are skipped. A missing value is
  `null`.
- The values are the stored values: the `toPublic` hooks of the target do not run.
- `defineContentType` warns for `publicFields` without `target`.

The preview does the same in the browser: `previewPublicFields`, `previewReferenceMediaIds` and the
`typeOf` argument of `toPreviewItem` (`shared/utils/content-preview.ts`). `post-preview.vue` keeps
the raw `publicFields` values of the loaded target items and loads their media.

## `remember`

`PlutoReferenceField.remember`: on a new item, the form fills the field with the value that the
user saved last time for this type. `defineContentType` warns for `remember` without `target`. The
form side comes in a later change (see the plan, PR B).

## Public types and composables

- `PlutoAuthor` (`id`, `name`, `slug`, `bio?`, `avatar?`, timestamps) and `PlutoPostAuthor` (a
  `PlutoPublicReference` with `avatar?` and `bio?`), in `shared/types/public-api.ts`.
  `PlutoPostSummary.authors?: PlutoPostAuthor[]`.
- `useAuthors(options)` (sort `name`, `authors` is the list) and `useAuthor(slug)` (`author`, 404
  when missing), in `app/composables/pluto-site-content.ts`. The posts of an author:
  `usePosts({ filter: { authors: slug } })`.

## Files and tests

- `modules/pluto-github/runtime/shared/{author-type,post-type}.ts`,
  `runtime/server/utils/github-setup.ts`, `runtime/app/plugins/pluto-github.ts`.
- `server/utils/pluto-reference-public.ts`, `shared/utils/content-preview.ts`,
  `app/pages/_pluto/post-preview.vue`, `shared/types/{content,public-api}.ts`.
- Tests: `test/reference-public.test.ts` ("publicFields"), `test/content-preview.test.ts`,
  `test/github-wiring.test.ts`, `test/github-push-capabilities.test.ts`,
  `test/github-references.test.ts` ("a rename or a delete of an author"),
  `test/site-content-composables.test.ts`, `test/content-define.test.ts`.
