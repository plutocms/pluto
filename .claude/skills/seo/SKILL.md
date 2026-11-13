# SEO add-on

`@plutocms/seo` (`packages/layers/addons/seo`) is the add-on layer for the SEO basics of a blog,
for every backend: SEO fields on a post with a search and social preview in the admin, head tags on
the item pages, `/sitemap.xml`, `/robots.txt` and an RSS 2.0 `/feed.xml`. Like `@plutocms/3d` and
`@plutocms/shop`, it does not extend core: the app or its backend layer brings core, so core loads
once. It needs core 0.57.0 or newer (an optional peer dependency). `templates/blog` extends it.

It does not own the `post` type. The Git CMS module of core owns one `post` type, and
`@plutocms/supabase-blog` owns the other. The layer adds its fields with the content type
extension of core (see "Content type extensions" in the content-model skill). Core has no SEO
code.

## Files

- `nuxt.config.ts`: `$meta.name: 'seo'`, no `extends`.
- `app/app.config.ts`: the defaults of `plutoSeo` (see "Settings").
- `shared/types/seo.ts`: `PlutoSeoConfig`.
- `shared/utils/seo-fields.ts`: `PLUTO_SEO_FIELDS`, `plutoSeoWithFields`,
  `plutoSeoTypeExtension`, `plutoSeoReadFrontmatter`, `plutoSeoWriteFrontmatter`.
- `shared/utils/seo-head.ts`: `plutoSeoItemHead`, `plutoSeoDescription`, `plutoSeoPlainText`,
  `plutoSeoCutText`, `plutoSeoCanonicalPath`, `plutoSeoIsPrivatePath`, `plutoSeoSiteHead`.
- `shared/utils/seo-xml.ts`: `plutoSeoEscapeXml`, `plutoSeoRfc822`, `plutoSeoRenderSitemap`,
  `plutoSeoRenderRss`, `plutoSeoRenderRobots`. Pure.
- `shared/utils/seo-preview.ts`: the text of the admin preview (`plutoSeoSearchCard`,
  `plutoSeoPreviewText`, `plutoSeoPreviewImageId`, `plutoSeoCount`).
- `server/plugins/seo.ts`: `extendContentTypes(plutoSeoTypeExtension(config))`.
- `server/utils/seo-entries.ts`: `plutoSeoListEntries`.
- `server/handlers/sitemap.get.ts`, `robots.get.ts`, `feed.get.ts`.
- `modules/pluto-seo/index.ts` and `routes.ts`: adds the handlers.
- `app/composables/seo.ts`: `usePlutoSeo`.
- `app/plugins/seo.ts`: the registry entries and the site-wide head.
- `app/components/PlutoSeoPreview.vue`: the `seo-preview` widget (admin).
- `i18n/locales/en.json`, `pt-BR.json`: `seo.preview.*` and `content.post.fields.seo*`.
- Every export of `shared/utils` and `server/utils` starts with `plutoSeo` or `PlutoSeo`
  (`PLUTO_SEO_*` for a constant), so it cannot clash with a name of an app or another layer.

## Settings

`plutoSeo` in the `app.config.ts` of the app. A module cannot read `app.config.ts` at build time,
so the three routes always exist, and the handlers read the settings with `useAppConfig()`.
Arrays join the defaults (`sitemap.paths`, `robots.disallow`). Use a map (`types`,
`sitemap.exclude`) where an app turns a default off.

| Key                | Default          | Meaning                                                               |
| ------------------ | ---------------- | --------------------------------------------------------------------- |
| `types`            | `{ post: true }` | The content types that get the fields. `false` turns one off.         |
| `image`            | `''`             | The default `og:image`: a site path or a full URL.                    |
| `twitterSite`      | `''`             | `twitter:site`, for example `@mysite`.                                |
| `indexable`        | `true`           | `false`: `noindex` on every page, and `Disallow: /` in robots.txt.    |
| `sitemap.paths`    | `['/']`          | Site paths that the sitemap lists besides the content.                |
| `sitemap.exclude`  | `{}`             | `{ product: true }` leaves a content type out of the sitemap.         |
| `robots.disallow`  | `[]`             | Site paths to disallow, besides the admin paths.                      |
| `feed.type`        | `'post'`         | The content type of `/feed.xml`.                                      |
| `feed.title`       | `''`             | The channel title. Empty: the site name, else `Feed`.                 |
| `feed.description` | `''`             | The channel description. Empty: the site description, else the title. |
| `feed.language`    | `''`             | The channel language, for example `pt-BR`.                            |
| `feed.limit`       | `20`             | The most items, 1 to 100.                                             |

The site URL is a setting of core: `runtimeConfig.public.websiteUrl` (`NUXT_PUBLIC_WEBSITE_URL`).
It can include the base path of a project site. Without it, a server build uses the origin of the
request. A static build has no request at run time, so without it the sitemap and the feed are empty
channels, the pages get no canonical URL and no `og:url`, robots.txt has no `Sitemap:` line, and the
build logs a warning. See the git-cms skill ("Static build").

## Fields and storage

`PLUTO_SEO_FIELDS` has five fields. Each is in the side column, out of the list, with the orders 900
to 904, and in the side group `seo` (`group: 'seo'`). `plutoSeoWithFields` adds the group itself
(`PLUTO_SEO_GROUP`: label `seo.group`, `lucide:search`, order 900, `defaultOpen: false`), so the
fields show in a collapsible "SEO" section, closed when the form loads. A type that has a group
`seo` already keeps its own. The preview comes first in the group. See "Side groups" in the
content-model skill.

| Field            | Type                                       | Supabase column (`posts`)                    | Git CMS file      | Flat key (Git hooks) |
| ---------------- | ------------------------------------------ | -------------------------------------------- | ----------------- | -------------------- |
| `seoPreview`     | `text`, `virtual`, `widget: 'seo-preview'` | none                                         | none              | none                 |
| `seoTitle`       | `text`                                     | `seo_title text null`                        | `seo.title`       | `seo_title`          |
| `seoDescription` | `textarea`, `rows: 3`                      | `seo_description text null`                  | `seo.description` | `seo_description`    |
| `seoImage`       | `media`, `accept: ['image/*']`             | `seo_image text null`                        | `seo.image`       | `seo_image`          |
| `seoNoindex`     | `boolean`                                  | `seo_noindex boolean not null default false` | `seo.noindex`     | `seo_noindex`        |

- The `column` of each field is snake_case. The columns are a contract with the migration
  `006_post_seo.sql` of supabase-blog. Do not rename them. Supabase has no hook: the adapter writes
  and reads the columns. Before migration 006 runs, a post save fails, because the columns do not
  exist.
- The Git CMS file has the shape of Nuxt Content and of the docs layer:

  ```yaml
  seo:
    title: A shorter title for Google
    description: One or two sentences for the search result.
    image: red-mug-k3j9a
    noindex: true
  ```

- The Git adapter writes each field as a flat frontmatter key (its `column`). The layer composes the
  `files.frontmatter` hooks of the type: the read hook adds the flat keys from the `seo` block (after
  the hook of the owner), and the write hook folds the flat keys into the block (before the hook of
  the owner) and drops them. The write hook keeps the keys of `seo` that it does not know. An empty
  value removes its key. An empty `seo` goes away. `noindex: false` is not written. A missing flat
  key means the author cleared the field.
- `plutoSeoWithFields(type)` appends the fields that the type does not have. A name that the type
  has already stays as the owner declared it, with a dev warning. When the type lists `api.fields`,
  the stored fields join the list. Without `api.fields`, the new fields reach the public API, the
  static index and `toPublicData` at once. `expandPublicMedia` makes `seoImage` a record.
- `seoTitle` and `seoDescription` match the docs type, so a public answer has the same shape.
- Field labels and descriptions are English literals. The layer gives `content.post.fields.seo*`
  in `en.json` and `pt-BR.json`. A type other than `post` keeps English for now.

## Content type extensions

`plutoSeoTypeExtension(config)` gives `{ id: 'seo', extend }`. `extend` adds the fields to the types
that `config.types` turns on, and reads `config.types` when it runs. Two places register it:

- Server: `server/plugins/seo.ts` calls `extendContentTypes(...)` with `useAppConfig().plutoSeo`.
  `getContentType` and `listContentTypes` give the extended type, so the generic routes, the public
  API and the static index all see the fields.
- Client: `app/plugins/seo.ts` gives it to `definePlutoExtension({ contentTypeExtensions })`.
  `usePlutoContentTypes()` gives the extended type to the form, the list and the head.

## The server

### `plutoSeoListEntries(event, typeName, options)`

The published items of a public type that has a page. `markPublicRead` runs first. A type that is
missing, private, or without `previewUrl` gives `[]`. It pages `adapter.list` by 100 with
`includeUnpublished: false`, keeps `isPublishedItem`, and takes the path from `type.previewUrl(item)`
(on the raw item). An entry is `{ path, item, noindex, publishedAt, updatedAt, data? }`. The dates
come from `adapter.timestampKeys`.

Options: `limit`, `sort` (a public API sort such as `-publishedAt`, resolved with
`parsePublicQuery`; a bad field keeps the sort of the type), `skipNoindex` (noindex items do not
count for `limit`) and `withData` (adds `data` with `toPublicData`, for the feed).

### The handlers

All three set the cache header of the public API (`setPublicApiCache`) and always answer 200.

- `/sitemap.xml`: the `sitemap.paths`, then every public type that has `previewUrl` and is not in
  `sitemap.exclude`. An item with `seoNoindex` stays out. `lastmod` is the update date, else the
  publish date. A URL is listed once (the first one wins, a later one adds a missing date). It keeps
  50,000 URLs at most. Without a site root it is an empty `urlset`.
- `/robots.txt`: `User-agent: *`, then `Disallow` for `<base>admin`, `<base>api/_pluto`,
  `<base>_pluto` and `robots.disallow`, then `Sitemap:` when the root is known. With
  `indexable: false`: `Disallow: /` only. A GitHub Pages project site serves it under `/repo/`, where
  crawlers do not read it. Put it at the domain root by hand there.
- `/feed.xml`: RSS 2.0 with `xmlns:atom` and `xmlns:dc`. The channel has the title, the link, the description,
  the language, `atom:link rel="self"` and `lastBuildDate`. The newest `feed.limit` items (100 at
  most) by `-publishedAt`, with no noindex item. An item has the title, the link,
  `guid isPermaLink="true"`, `pubDate` (RFC 822), the description (`seoDescription`, else the
  excerpt) and `dc:creator` (the author names joined with ", ", when the item has authors). No full
  HTML in v1. A missing or private type, or an unknown site root, gives a valid
  channel with no items.

The renderers in `seo-xml.ts` are pure and escape every value (`plutoSeoEscapeXml` also drops the
control characters that XML 1.0 does not allow).

### The module

`modules/pluto-seo` adds the three routes with `addServerHandler`. It skips a route when the app (or
a layer) has a file of the same name in `public/`. In a static build it adds the routes to
`nitro.prerender.routes`, in the `nitro:config` hook, and it warns when no site URL is set. Nuxt
sets `nitro.prerender.failOnError`, so each route must answer 200: that is why a feed type that is
off gives an empty channel, not a 404. The module imports nothing from core. It reads the static
flag that core sets (`runtimeConfig.public.plutoPublicApi.static`). The pure rules are in
`modules/pluto-seo/routes.ts`.

## The head

- `usePlutoSeo(item, { type?, ogType? })`: sets the tags of one item page with `useSeoMeta`, from
  `plutoSeoItemHead`. Title: `seoTitle`, else the title field. Description: `seoDescription`, else
  `excerpt`, else `description`, else `bio` (an author page), else the plain text of `html` cut at 160. Image: `seoImage`, else
  `cover`, else the first `media` field with a file, else `plutoSeo.image`; it is absolute, with the
  alt text and the size. It sets `og:*`, `twitter:*`, `twitter:card` (`summary_large_image` with an
  image), `robots: noindex, follow` for `seoNoindex`, and `<meta name="author">` (the names joined
  with ", "). For an `article` it also sets the published and modified times, one `article:author`
  per author (the author page URL, else the name) and a JSON-LD `BlogPosting` script
  (`plutoSeoArticleJsonLd`: headline, description, image, dates, the authors as `Person` with
  `name`, `url` and `image`, and the page URL). The script text comes from `plutoSeoJsonLdText`,
  which escapes `<`, `>`, `&`, U+2028 and U+2029, so no value can close the script. It returns the
  head as a computed value.
- The authors (`plutoSeoAuthors`): the expanded references of the item field `authors` (a list), else
  `author` (one), in order. The name is `label` (or `name`). The URL comes from the `previewUrl` of
  the target type of that field (`plutoSeoAuthorUrl`, with `typeOf`), made absolute. The image is the
  `avatar` record. A plain id is skipped. See the authors skill of core.
- The plugin registers a `contentHead` entry for every type (`'*'`). Core calls it inside
  `definePlutoContent().useItem`, after its own tags, so `usePost` and the other content pages get
  the tags with no page change. A page that uses `seo: false` skips it. A page that you wrote
  yourself calls `usePlutoSeo`.
- The plugin also sets one site-wide `useHead` (`plutoSeoSiteHead`): the canonical URL and
  `og:url`, `og:site_name`, a default `twitter:card`, `twitter:site`, the default `og:image`, the RSS
  `<link rel="alternate">` when the feed type is public, and `robots: noindex, nofollow` when
  `indexable` is false. The canonical URL is the path, plus `?page=N` when N is above 1. The admin
  (`/admin`, `/_pluto`, `/api/_pluto`) and the error page get none. Without a known site root, there
  is no canonical URL and no `og:url`.
- A later head entry wins over an earlier one for the same key (Unhead). The plugin comes first, the
  page next, then the content head. The spike below checked it.

## The preview widget

`PlutoSeoPreview.vue` is the `seo-preview` widget, loaded on demand. It reads
`usePlutoContentForm()` (`item`, `type`), so it follows what the author types. It shows a search
result (host, path, title, description, the counts, and a warning over 60 and 160 characters), and
a social card. The image goes through `usePlutoMedia().get([id])`. The address is
`usePlutoSite().absoluteUrl(type.previewUrl({ ...item, status: publishedValue }))`: the address of the
page once published. It uses Nuxt UI semantic classes only. Outside a form it renders nothing.

## Spike (2026-11-05)

- A server route in the playground read `useAppConfig(event).plutoSeo` and got the defaults that
  the layer sets. So a handler can read the settings. The handlers call `useAppConfig()` with no
  event: it gives the shared frozen config, with no copy for each request. In dev, a change to
  `app.config.ts` shows in the handlers after a restart of the dev server.
- A page `useSeoMeta({ description, ogTitle })` won over a plugin `useHead` with the same keys, and
  the HTML had one tag of each. So the order of the head entries is right.

## Tests

`packages/layers/addons/seo/test/`: `config` (package rules), `fields`, `frontmatter`,
`git-roundtrip` (the real Markdown adapter of core over the memory store: the file has the `seo:`
block and no `seo_*` key, and the public answer has `seoImage` as a record), `entries`, `xml`,
`sitemap`, `robots`, `feed` (the real handlers over the memory store, in `helpers/server.ts`),
`module`, `head`, `preview`. They are plain Vitest with no Nuxt environment. The handlers use names
that Nitro auto-imports, so the tests stub them with `vi.stubGlobal`.

## Known limits

- One feed, for one type, description only. Atom, full HTML and more feeds come later.
- Redirects are not in the layer.
- A `product` type has no SEO columns on Supabase yet. Turn the layer on for `post` only.
- Do not save content in the playground with the Git CMS: the local Git commits go into this repo.
  Make a test post as a file, then remove it.
