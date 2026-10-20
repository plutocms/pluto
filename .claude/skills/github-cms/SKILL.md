# GitHub CMS

Pluto core gets an optional standalone CMS. Blog posts are Markdown files with YAML frontmatter in
a GitHub repo. Editors change them in the Pluto admin. The public site reads them live through the
GitHub API, with a cache. Users with push access to the repo are editors. They sign in with a
GitHub App. A draft is a post with `status: draft` in its frontmatter.

## Off by default

The CMS is off unless the app sets `plutoCms.enabled: true`. When it is off, the `pluto-cms`
module adds nothing: no runtime config key, handler, plugin, page, middleware or import.

The CMS refuses to run with the supabase layer. A layer with `$meta.name === 'supabase'`, or the
`@nuxtjs/supabase` module, counts as the supabase layer. If an app enables the CMS with it, the
module logs this error and stays off:

> The standalone CMS cannot run with the supabase layer. Remove plutoCms.enabled or the supabase
> layer.

A supabase app that does not set `plutoCms.enabled` sees no change and no log line.

## Files

- `modules/pluto-cms/index.ts` — the Nuxt module (config key `plutoCms`).
- `modules/pluto-cms/options.ts` — pure helpers: `resolvePlutoCmsOptions`, `normalizeCmsDir`,
  `PLUTO_CMS_SECRET_ENV`. No Nuxt imports, so plain Vitest can test them.
- `shared/types/cms.d.ts` — the `@nuxt/schema` types for `plutoCms`.
- `test/pluto-cms-options.test.ts` — the unit tests.

## Options

| Option | Default | Rule |
|---|---|---|
| `enabled` | `false` | Turns the CMS on. |
| `storage` | `'github'` | `'github'` or `'fs'`. `'fs'` is valid in dev only. |
| `github.repo` | none | `owner/name`. Required when storage is `github`. |
| `github.branch` | `'main'` | The branch to read and commit to. |
| `github.appSlug` | `''` | The slug of the GitHub App. |
| `github.apiUrl` | `'https://api.github.com'` | The API base URL. |
| `dir` | `'content'` | Relative path. No `..`, no leading `/`, no drive letter. The module changes `\` to `/` and removes a trailing `/`. |
| `commit.skipDeploy` | `true` | Add a skip-deploy marker to commit messages. |
| `cache.headTtl` | `60` | Seconds. Zero or more. |
| `cache.storage` | `'cache'` | The Nitro storage mount for the cache. |
| `postType` | `true` | Register the fixed post content type. |

A bad option turns the CMS off and logs an error. The module does not throw.

## Secrets

The secrets are run-time env vars. The module does not check them at build time. Set them as
`NUXT_PLUTO_CMS_<NAME>`, for example `NUXT_PLUTO_CMS_SESSION_PASSWORD`. The module puts an empty
string in `runtimeConfig.plutoCms` for each one, so Nuxt can override it.

Required: `SESSION_PASSWORD`, `GITHUB_APP_ID`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`,
`GITHUB_PRIVATE_KEY`. Optional: `GITHUB_READ_TOKEN`.

## Runtime config

When on, the module writes `runtimeConfig.plutoCms` (the secrets) and
`runtimeConfig.public.plutoCms` (`enabled`, `repo`, `branch`, `appSlug`, `storage`, `dir`).

## Storage

The storage layer is in `modules/pluto-cms/runtime/server/`. The module does not wire it in yet.
PR 4 does that. Every runtime file uses explicit imports. The pure helpers run in plain Vitest.

- `store/types.ts` — the `PlutoCmsStore` contract: `head`, `listDir`, `readFile`, `commit`. A
  commit takes `expectedHeadOid`. A stale value throws `PlutoCmsConflictError`. PR 4 maps it to 409.
- `store/errors.ts` — `PlutoCmsStoreError` with a `code`: `conflict`, `auth`, `forbidden`,
  `rate-limit`, `not-found`, `github`. The code has no HTTP link. PR 4 maps it.
- `store/memory.ts` — an in-memory store for tests.
- `store/fs.ts` — a dev store over a local dir. The head is a hash of the file listing. It refuses
  any path outside the root.
- `store/github.ts` — `createGithubStore`. `head` uses the REST sha call with an ETag and a TTL.
  `listDir` is one GraphQL call. `commit` uses `createCommitOnBranch` and sets the cached head at once.
- `github/client.ts` — `githubRest` and `githubGraphql`. They take an injectable `fetch`
  transport. The default uses `ofetch`. They throw typed errors.
- `utils/cms-cache.ts` — the head with a TTL, the dir index by `<dir>@<headOid>`, parsed blobs by
  blob id, and single-flight. The backend is a Map by default.
  `utils/cms-cache-nitro.ts` gives a backend over Nitro `useStorage`.
- `utils/markdown-file.ts` — parse and write Markdown with YAML frontmatter. It uses the `yaml`
  core schema, so a tag never runs code.
- `utils/blob-sha.ts` — `gitBlobSha` and `listingOid`.
- `utils/cms-paths.ts` — `assertSafeSlug`, `contentFilePath`, `contentDirPath` and `slugifyTitle`.
- `test/fixtures/fake-github.ts` — an in-memory GitHub that counts calls by kind.

## Adapter

`runtime/server/adapter.ts` has `createMarkdownContentAdapter`. It is a `PlutoContentAdapter` over a
`PlutoCmsStore`. The module does not register it yet. PR 5 adds the wiring with auth. Options:
`store`, `dir`, `getAccess`, `commit.skipDeploy`, `cache`, `retries` (default 2).
`runtime/shared/post-type.ts` has `plutoCmsPostType`, the built-in `post` content type.

File layout:

- A file is `<dir>/<type.source>/<slug>.md`. The post type uses `source: 'posts'`.
- The item `id` is the slug. It is the file name. It is not a frontmatter key.
- A slug uses lowercase letters, numbers and single dashes. The create call makes it from the title
  when the payload has none.

Frontmatter mapping:

- The first `richtext` field is the Markdown body.
- Every other field, except the slug field, is a frontmatter key. The key is the field column
  (`fieldColumn`), the same rule as the other adapters.
- The status key and the timestamp keys come from `type.status` and `type.timestamps`. The adapter
  sets the timestamps. A payload cannot set them. The adapter sets `publishedAt` on the first
  publish only. Without a `timestamps` setting, the keys are `createdAt` and `updatedAt`.
- An update keeps frontmatter keys that the type does not know.
- A file with no status key counts as the default status (`draft` for posts).
- Every returned item has `_version`. It is the blob id of the file. A list item has no body.
  The excerpt field stays in the list item.

Access rules:

- `getAccess(event)` returns `{ capabilities, auth }`, or `null` for an anonymous caller.
- An anonymous caller sees published items only. This holds for `list`, `get` and `countCreated`,
  even when the query asks for drafts.
- A signed-in caller sees drafts only with the type read capability (`posts:read_drafts`).
- Every write needs access (401). It needs the write or delete capability (403). A change of the
  published state needs the publish capability. `authorize` fails closed in the same way.

Conflict handling:

- An update with a stale `_version` gives 409 (`pluto.errors.conflict`). A missing `_version`
  skips this check.
- A create or rename to a taken slug gives 409 (`pluto.cms.errors.slugTaken`).
- A rename is one commit: it adds the new path and deletes the old one.
- A commit uses a fresh head as `expectedHeadOid`. When the head is stale, the adapter retries up
  to 2 times, but only if the target file did not change. Otherwise it gives 409.
- Commit messages: `content(post): create "slug"`, `update`, `publish`, `unpublish`,
  `rename "a" -> "b"`, `delete`. `[skip ci]` is added when `skipDeploy` is on.

Store errors map to HTTP errors with `pluto.cms.errors.*` keys: conflict 409, auth 401, forbidden
403, rate limit 503 with a `Retry-After` header, not found 404, GitHub failure 502.

The contract test suite is `test/contracts/content-adapter.contract.ts`
(`runContentAdapterContract`). Run it against any new adapter over the post type.

## Status

PR 2 (module skeleton), PR 3 (storage layer) and PR 4 (Markdown content adapter) are built. These
parts are not built yet:

- PR 5: auth (GitHub App sign-in, sealed session, origin check), and the wiring of the stores
  and the adapter into the module.
- PR 6: the editor, the public read routes and `PlutoMarkdown`.
- PR 7: user docs.
