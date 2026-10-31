# Docs setup

The layer edits the pages of a Nuxt Content site in the Pluto admin. The app turns it on with
`extends` and one config key (`plutoDocs.types`). This skill describes the module, the options, and the plugins.

## Files

- `nuxt.config.ts` — extends `process.env.PLUTO_CORE_PATH || '@plutocms/core'`, adds the
  `@nuxt/content` module, sets `$meta.name: 'docs'`, the native SQLite connector, and the
  layer defaults `plutoGithub.postType: false` and `plutoGithub.commit.skipDeploy: false`. It has no `css`
  entry. The other `plutoGithub` options use the core defaults (`enabled: 'auto'`, `storage` by mode,
  the repo from the env or the git remote). See the `github-cms` skill in pluto.
- `modules/pluto-docs/index.ts` — the Nuxt module. Config key `plutoDocs`.
- `modules/pluto-docs/manifest.ts` — the build manifest of the hybrid mode (Node).
- `modules/pluto-docs/blocks.ts` — the discovery of the block components (Node, no Nuxt import). See the
  block-model skill, "Discovery".
- `modules/pluto-docs/options.ts` — pure helpers: `resolvePlutoDocsOptions`,
  `isValidSource`, `normalizeRoutePrefix`. No Nuxt import, so plain Vitest tests them.
- `shared/types/docs.d.ts` — the `@nuxt/schema` types for the config key.
- `shared/types/pluto-blocks.d.ts` — the types of the virtual module `#pluto-docs/blocks`.
- `app/plugins/pluto-docs.ts` — the client plugin.
- `server/plugins/pluto-docs.ts` — the Nitro plugin.
- `test/module-options.test.ts` — the unit tests.

## Options

```ts
plutoDocs: {
  types: [{ preset: 'docs', name: 'doc', source: '', label?, labelPlural?, exclude?, routePrefix?, navGroup?, icon? }],
  render: 'hybrid', // default; or 'build', or 'runtime'
  runtimeMaxAge: 10, // seconds of the public cache of the layer routes
  blocks: { discover: true }, // read components/content/ for definePlutoBlock (default); false turns it off
}
```

- Default `types` is `[]`.
- `name` uses lowercase letters, numbers and dashes, and starts with a letter. It is unique.
- `source` is `''` (the content dir itself) or a nested folder path (`1.docs/api`).
- `exclude` is a list of ids or folders (`index`, `drafts/`).
- `routePrefix` is the route prefix of the pages on the public site, for the View link of the form.
- `navGroup` is the nav group of the type in the admin menus. Default `'pages'` (core's group). A string is a group id.
  `false` gives the type its own item. See the docs-preset skill.
- `icon` is the Iconify name of the type in the admin (the sidebar, the New menu, the dashboard). Default `lucide:book-open`.
- A type with a problem is dropped, and the module logs one error for it.
- `render` is `'hybrid'` (default), `'build'` or `'runtime'`. A bad value gives one error and uses `'hybrid'`. See
  "Render modes".
- `runtimeMaxAge` is a whole number of seconds, 0 or more (default 10). A bad value gives one error and uses 10.
- `blocks.discover` is `true` or `false` (default `true`). A bad value gives one error and uses `true`. With
  `true`, a component in `components/content/` (the app or a layer) that calls `definePlutoBlock(...)`
  shows in the block palette. The module adds `definePlutoBlock` as an auto-import. See the block-model
  skill, "Discovery".

## Render modes

`plutoDocs.render` is `'hybrid'` (default), `'build'` or `'runtime'`.

**Breaking change:** the default was `'build'`. Pluto has no users yet, so there is no migration. A site that
wants the old behavior sets `render: 'build'`. Hybrid and run-time mode need a server, and the app must not
prerender the content pages (no `crawlLinks`, no prerender route of a page).

- `'build'`: Nuxt Content builds the pages. The composables call `queryCollection`. The layer adds no route.
- `'runtime'`: every answer comes from the content repository, through the registered content adapter.
- `'hybrid'`: the answer comes from the build data (Nuxt Content on the server) while the store has the same files
  as the build. A changed or new page comes from the store. When any file differs, the navigation and the surround
  come from the store. A removed page is a 404. A store error gives the build data.

Files:

- `modules/pluto-docs/manifest.ts` — Node, build time. `buildContentManifest`, `buildTypeManifest`,
  `versionOf`, `gitBlobSha`, `isListedId`, `manifestModuleSource`.
- `shared/utils/runtime-content.ts` — pure: `buildNavigationTree`, `flattenNavigation`, `surroundOf`,
  `pageIdForRoute`, `diffManifest`, `folderItemFields`, `frontmatterExtras`. The tree follows Nuxt Content's
  `generateNavigationTree` (same `ContentNavigationItem` shape, `page: false` folders, the index page merged into
  its folder, `.navigation.yml` applied).
- `shared/utils/navigation-config.ts` — `parseNavigationConfig` (YAML of a `.navigation.yml`).
- `server/utils/pluto-docs-runtime.ts` — `plutoRuntimePage`, `plutoRuntimeNavigation`,
  `plutoRuntimeSurround`.
- `server/handlers/{page,navigation,surround}.get.ts` — thin handlers. The module adds them with
  `addServerHandler` in `'hybrid'` and `'runtime'` mode, on the public API of Pluto:
  `/api/pluto/v1/docs/:type/{page,navigation,surround}` (`RUNTIME_ROUTE_BASE`). The answer is `{ data }`,
  like core's public routes; the composables read `data`. Core's CORS rule (`plutoApi.cors`) covers them.
- The docs type sets `api: { public: true }`, so the pages are on core's public API too:
  `/api/pluto/v1/content/<type>[/<id>]` (a list item has `excerpt`, one item has `html`, from the CMS adapter).
- `app/composables/pluto-content-runtime.ts` — the composables (below).
- Tests: `test/runtime-content.test.ts`, `test/content-manifest.test.ts`, `test/module-options.test.ts`.

### The build manifest

The module makes a Nitro virtual module `#pluto-docs/manifest` in the `nitro:config` hook. It is
`{ [typeName]: { [contentId]: version } }`. It is made once, when the bundler first asks for it, from the `.md`
files under `<rootDir>/<plutoGithub.dir>/<type.source>` (the same files that the CMS lists: dot files and dirs, and
`node_modules`-like dirs are skipped, ids follow the CMS id rule and `exclude`). In `'build'` and `'runtime'`
mode the module is `{}`.

The version is the `_version` that the store reports for the file:

- Storage `github`: the Git blob id. The text is hashed with CRLF turned to LF, because Git keeps LF in the blob.
  A Windows working file with CRLF then has the same version as the blob. A file that really has CRLF in the
  repository looks changed at run time, which is safe: the page comes from the store.
- Storage `fs` (and `memory`): core's fs store hashes the file as it is on the disk (`gitBlobSha(raw text)`), so the
  manifest does too.

The storage and the dir come from `runtimeConfig.public.plutoGithub`, which the CMS module sets.

### The routes

Every route: `markPublicRead(event)` first (core util, the request is anonymous, no session cookie). A 404 when the
mode is `'build'` or the type is unknown. `Cache-Control: public, s-maxage=<runtimeMaxAge>, stale-while-revalidate`
(`runtimeMaxAge` default 10, `0` is `no-store`). The query `collection` names the Nuxt Content collection for the
build data (hybrid); it must be a plain name.

- `page?path=/a/b&collection=docs` — lists the type (the adapter caches it by the head), compares it with the
  manifest (`diffManifest`). Hybrid and the page is not changed or added: `queryCollection(event, collection).path().first()`.
  Else the page from the store: `adapter.get`, parsed with `parseMarkdown` (`@nuxtjs/mdc/runtime`), cached in
  memory by blob id (at most 200). A path that is in the manifest but not in the store is a 404.
  The code highlighter is `#mdc-highlighter`. The `toc` rules come from `content.build.markdown.toc`, copied to
  the private `runtimeConfig.plutoDocs`.
- `navigation?collection=docs&includeRoot=1` — hybrid and no difference: `queryCollectionNavigation`. Else the tree
  from the store.
- `surround?path=&collection=docs` — hybrid and no difference: `queryCollectionItemSurroundings`. Else from the store tree.
- A store error in hybrid mode (no App, rate limit, outage) gives the build data. In `'runtime'` mode it is the error.

The page from the store has the fields of a Nuxt Content page: `id`, `stem`, `extension`, `path`, `title`,
`description`, `seo` (the title and description default to the page ones, like Nuxt Content), `navigation`, `body`
(with `body.toc`), plus the whole frontmatter (`item._frontmatter`, the core contract): every key that is not a
page field is at the top level and in `meta`. Nuxt Content puts the keys that the collection schema declares at
the top level and the other keys in `meta`. The server does not know the schema, so a key goes in both places.

Parity of the navigation: `.navigation.yml` of each folder is read with `adapter.readFile` (the path is relative to
the type folder). `title`, the other keys (`icon`, ...) and the `navigation` object go to the folder item, and
`navigation: false` hides the folder and its pages (the rules of `pickConfigNavigationFields`). The configs are cached
in memory by the listing (ids and versions), so an unchanged listing reads no file. An adapter without `readFile`
gives no configs. The manifest covers `.md` files only: a change of a `.navigation.yml` file shows after the next
deploy, or with the next page difference.

### Composables

Auto-imported. They hide the mode. Each returns the `useAsyncData` result.

- `usePlutoContentPage(path, { collection, type? })` — `'build'`: `queryCollection(collection).path(path).first()`.
  Else the page route.
- `usePlutoContentNavigation({ collection, type?, includeRoot? })` — `'build'`: `queryCollectionNavigation`. Else the route.
- `usePlutoContentSurround(path, { collection, type?, includeRoot? })` — `'build'`: `queryCollectionItemSurroundings`.
  Else the route.
- `usePlutoContentRender()` — `'hybrid'`, `'build'` or `'runtime'`.

### liveOnSave

In `'hybrid'` and `'runtime'` mode the layer sets `liveOnSave: true` on its content types (`createDocsType` option
`liveOnSave`). Core then shows "Live" at once after a save, and shows the static build as a small spinner. This needs
the core version that has the field.

### Core contract

The layer needs a pluto version with `markPublicRead`, `PlutoContentAdapter.readFile`, `_frontmatter` on `get`, and
`PlutoContentType.liveOnSave`. A save commits through the adapter, and the store sets the new head in its cache at once,
so the next request of the same server reads the new text. Other instances follow within `plutoGithub.cache.headTtl`.

Limits: the search stays build time. The root `index` page is not in the navigation from the store unless
`includeRoot` is set. A `.navigation.yml` of the root folder is not read. Hybrid mode checks the list of files, not
the content of non-`.md` files.

## The CMS must be on

The module reads `nuxt.options.plutoGithub.enabled`. Core defaults it to `'auto'`, so an app
sets nothing. When the app sets `plutoGithub.enabled: false`, the module logs this error and stays
off:

> The docs layer needs the standalone CMS. Remove plutoGithub.enabled: false, or remove the
> layer.

When the module is on, it copies the valid types to `runtimeConfig.public.plutoDocs`.
When it is off, that key does not exist. Both plugins return at once when the key is missing.

## The plugins

Both plugins live in the layer dirs (`app/plugins`, `server/plugins`), so the layer needs no
`addPlugin` call and no auto-import trick. They build each type with `createDocsType` from the
shared config.

- The Nitro plugin calls `registerContentType` (core) for each type. The CMS Nitro plugin
  registers the adapter. The order of the two plugins does not matter, because the adapter looks
  up the type for each request.
- The client plugin calls `definePlutoExtension` (extension id `docs`) with the
  `contentTypes`, the `capabilities` (`docs:write`, `docs:delete`), the `mdc` field widget
  (`defineAsyncComponent`), and the admin bar actions. The module also adds the route rules of the
  preview page `/_pluto/preview` (see the block editor skill).

## The app side

- `content.config.ts` of the app defines the collections. The layer defines none.
- The CSS entry of the app has the single Tailwind build. See the
  [admin bar offset](../admin-bar-offset/SKILL.md) skill.
- The app uses `PlutoRoot` in `app.vue`. `PlutoRoot` renders a `NuxtLayout`, so a site that wraps
  its header and footer in `app.vue` must not use a page layout for the docs sidebar. Put the
  sidebar in a component instead.
- Pluto sets `eslint.config.standalone: false` and button, input and form field sizes `xl`. A
  site with its own ESLint config and the Nuxt UI default sizes sets them back in its own config.

## Local development

The layer needs Pluto 0.20 or newer. To test unpublished Pluto changes, run the commands with
`PLUTO_CORE_PATH=<path to pluto>`. An app that extends this layer from a local folder uses the
`plutoLayer` helper (`@plutocms/core/layers`) with `PLUTO_LOCAL_ROOT`. See the `local-layers`
skill in pluto.
