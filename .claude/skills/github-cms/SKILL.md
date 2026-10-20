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
- `runtime/server/utils/{session,github-oauth,auth-flow,origin,rate-limit,cms-config,cms-setup}.ts`,
  `runtime/server/github/app-token.ts`, `runtime/server/api/auth/**`,
  `runtime/server/middleware/pluto-cms-origin.ts`, `runtime/server/plugins/pluto-cms.ts` — the
  authentication and the wiring (see "Authentication" and "Wiring").
- `runtime/app/{composables,plugins,middleware}/` — the client side.
- `app/components/Pluto/Cms/` — the login page, the navbar, the dashboard warning, the editor
  widget and `PlutoMarkdown`.
- `runtime/server/utils/{markdown,sanitize-html,public-content}.ts`,
  `runtime/server/api/public/[type]/`, `runtime/shared/public-types.ts` and
  `runtime/app/composables/pluto-cms-content.ts` — the public read side (see "Public read").

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
| `cache.publicMaxAge` | `60` | Seconds. Zero or more. The `s-maxage` of the public read routes. |
| `postType` | `true` | Register the fixed post content type. |

A bad option turns the CMS off and logs an error. The module does not throw.

## Secrets

The secrets are run-time env vars. The module does not check them at build time. Set them as
`NUXT_PLUTO_CMS_<NAME>`, for example `NUXT_PLUTO_CMS_SESSION_PASSWORD`. The module puts an empty
string in `runtimeConfig.plutoCms` for each one, so Nuxt can override it.

Required: `SESSION_PASSWORD`, `GITHUB_APP_ID`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`,
`GITHUB_PRIVATE_KEY`. Optional: `GITHUB_READ_TOKEN`, `ALLOWED_USERS`.

## Runtime config

When on, the module writes `runtimeConfig.plutoCms` (the secrets) and
`runtimeConfig.public.plutoCms` (`enabled`, `repo`, `branch`, `appSlug`, `storage`, `dir`).

## Storage

The storage layer is in `modules/pluto-cms/runtime/server/`. The Nitro plugin wires it in (see
"Wiring"). Every runtime file uses explicit imports. The pure helpers run in plain Vitest.

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
`PlutoCmsStore`. The Nitro plugin registers it (see "Wiring"). Options:
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
- A signed-in caller sees drafts only with the type read capability (`posts:read_drafts`). The
  capability `*` counts as every capability.
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

## Wiring

When `plutoCms.enabled` is true, and only then, the module adds:

- Four server routes under `/api/_pluto/auth/` (see "Authentication").
- A server middleware, `middleware/pluto-cms-origin.ts`, for the CSRF check.
- A Nitro plugin, `plugins/pluto-cms.ts`. It picks the store (`github` with the Nitro cache, or `fs`
  rooted at the project dir in dev), registers the `post` type when `postType` is on, and registers
  the Markdown adapter. `getAccess(event)` gives the signed-in user (their GitHub token and
  capabilities) or `null`.
- A client plugin, `runtime/app/plugins/pluto-cms.ts`. It calls `definePlutoExtension` with the
  navbar, the post content type, the post capabilities, the permissions driver and the public-repo
  dashboard widget. It also loads the capabilities when the session appears.
- A global route middleware, `runtime/app/middleware/pluto-cms-auth.ts`.
- The auto-import dir `runtime/app/composables` (`usePlutoCmsSession`).
- The page `/admin/login` with `extendPages`. If the app already has that page, the module keeps
  it, adds nothing and logs a warning.

The module puts the non-secret server settings in the private `runtimeConfig.plutoCms`: `apiUrl`,
`skipDeploy`, `headTtl`, `cacheStorage`, `postType`, `fsRoot`. `utils/cms-config.ts` reads all
config in one place (`getCmsConfig`). A test mocks that file.

The `fs` store root is the project dir (the same layout as the repo), so a post is at
`<project>/content/posts/<slug>.md`.

The Vue files are in `app/components/Pluto/Cms/`, because Tailwind scans the `app/` dir of a layer
only: `PlutoCmsLoginPage`, `PlutoCmsNavbar`, `PlutoCmsNavbarProvider` and
`PlutoCmsPublicRepoWarning`. They use explicit imports for the session composable, so the type
check works when the CMS is off.

## Authentication

A user signs in with a GitHub App (the user-to-server OAuth web flow). Only users with push access
to the content repo can sign in.

### Flow

1. `GET /api/_pluto/auth/github/login?redirect=/path`. The `redirect` must be a path on this site:
   one `/` at the start, not `//`, no `\`, no control character, no other origin. Any other value
   becomes `/admin/home`. The route makes `state` (32 random bytes, base64url) and a PKCE verifier.
   It saves `{ state, verifier, redirect }` in a separate sealed session, `pluto-cms-oauth`, which
   lives 10 minutes. Then it answers 302 to `github.com/login/oauth/authorize` with `client_id`,
   `redirect_uri`, `state`, `code_challenge` and `code_challenge_method=S256`.
2. `GET /api/_pluto/auth/github/callback`. The route reads and clears the oauth session first, so
   `state` works once. It compares `state` in constant time. A mismatch gives 302
   `/admin/login?error=state`. Then it trades the code for tokens (with the client secret and the
   PKCE verifier), reads `/user`, and reads `/repos/{owner}/{repo}` with the USER token:
   - 404 (the user or the App cannot see the repo): `?error=not_installed`.
   - Permission is not admin, maintain or push: `?error=forbidden`.
   - The login is not in `allowedUsers` (when it is set): `?error=forbidden`.
   - Any other failure: `?error=github`. The user cancels at GitHub: `?error=denied`.
   - Else it starts the session and answers 302 to the saved `redirect` (checked again).
3. `GET /api/_pluto/auth/session` answers `{ user, capabilities, repo: { name, private } }` or
   `{ user: null }`. It never has a token. A session that is over also answers `{ user: null }`.
4. `POST /api/_pluto/auth/logout` deletes the cookie and answers 204. It works even when the
   session password is missing.

Every auth response has `Cache-Control: no-store`. The login and callback routes allow 20 requests
a minute for each IP, then answer 429 (`utils/rate-limit.ts`). The counter is in memory, one per
server instance. It is a brake, not a gate. The IP is the socket address, or `x-forwarded-for`.

### Session

`utils/session.ts` uses h3 `useSession`. The cookie is `pluto-cms-session`: sealed, httpOnly,
SameSite=Lax, Secure when not in dev, `maxAge` 7 days from the sign-in. A session header is off.
The password is `runtimeConfig.plutoCms.sessionPassword` and needs 32 characters or more. In
production a missing or short password makes the sign-in routes answer 500
(`pluto.cms.errors.authNotConfigured`) and logs one error. In dev it uses a random password for the
process, so a restart signs everyone out.

The cookie holds `{ user: { id, login, name, avatarUrl }, token, refreshToken, expiresAt,
refreshExpiresAt, permission, capabilities, checkedAt, repoPrivate }`. It is sealed, not stored on
the server, so a logout does not revoke a copy of the cookie. The token expiry and the permission
check below limit that.

Exports: `getCmsSession(event)`, `requireCmsSession(event)` (401
`pluto.cms.errors.signInRequired`), `requireCmsCapability(event, cap)` (403), `setCmsSession`,
`clearCmsSession`. A request with no cookie reads as signed out and sets no cookie. Each request
reads the session once.

- Refresh: when `expiresAt` is less than 5 minutes away, the session refreshes the user token with
  the refresh token. GitHub rotates the refresh token. The first refresh wins. Requests that run at
  the same time share it. A request that arrives within 60 seconds with the old cookie reuses the
  result (memory of this process only). If GitHub refuses the refresh token, the session clears and
  the answer is 401. If GitHub does not answer, the answer is 503 and the session stays.
- Permission check: when `checkedAt` is older than 10 minutes, the session reads the repo again
  with the user token and updates the capabilities. If push access is gone, or GitHub rejects the
  token, the session clears and the answer is 401. If GitHub does not answer, the answer is 503.
- Capabilities: admin and maintain give `['*']`. Push gives the post type keys
  (`plutoCmsPostType.capabilities`: `posts:read_drafts`, `posts:publish`, `posts:delete`). The
  adapter and `requireCmsCapability` treat `*` as every capability. GitHub still enforces the real
  permission on each commit, because the commit uses the user token.
- Dev `fs` store: in dev with `storage: 'fs'`, a request from this machine gets a fixed user
  `local` with `['*']`. The check reads the socket address. A request is not local if it has
  `x-forwarded-for` or `forwarded`, or if its `Host` is not `localhost`, `127.0.0.1` or `[::1]`. So a
  tunnel or a DNS-rebinding page gets no access. Every other request is signed out.

### Anonymous reads

An anonymous caller sees published posts only. The store reads with a server token
(`github/app-token.ts`):

1. `runtimeConfig.plutoCms.githubReadToken` (a read-only token), when set.
2. Else an installation token of the App. The code signs an App JWT (RS256, `iat` now minus 60
   seconds, `exp` now plus 540 seconds, `iss` the app id). The private key may use literal `\n`
   escapes. It reads `GET /repos/{o}/{r}/installation`, then `POST
   /app/installations/{id}/access_tokens` for this repo with `contents: read`. It caches the token
   in memory until 5 minutes before it ends.
3. With neither set, an anonymous read answers 503 (`pluto.cms.errors.githubUnavailable`) and logs
   the cause once. The server does not fail at boot.

A signed-in user reads and writes with their own token.

### CSRF

SameSite=Lax is the first guard. `middleware/pluto-cms-origin.ts` is the second. For a request that
is not GET, HEAD or OPTIONS to `/api/_pluto/**`, the `Origin` header (or `Referer` when `Origin` is
absent) must have the same `host:port` as the `Host` header. A mismatch, a bad value such as
`Origin: null`, or no header at all gives 403 (`pluto.cms.errors.crossOrigin`). The check uses the
`Host` header and ignores `x-forwarded-host`: Nitro has no setting that trusts a proxy, and a client
can fake that header. A proxy in front of the app must pass the public `Host` header. GET routes
never change state.

### Client

- `usePlutoCmsSession()` gives `{ user, capabilities, repo, loggedIn, status, ready, refresh,
  logout }`. It uses `useFetch` with the key `pluto-cms-session` and `server: false`, so the
  server HTML of a public page never holds a user (a CDN may cache it). The admin is client-only.
- The route middleware sends a signed-out user on `/admin/**` (not `/admin/login`) to
  `/admin/login?redirect=<fullPath>`. A signed-in user on `/admin/login` goes to `/admin/home`.
  This is a UI guard only. The server checks every request.
- The login page has one "Sign in with GitHub" button. It is a full page load to the login route.
  It shows an error for `forbidden`, `not_installed` (with a link to
  `https://github.com/apps/<appSlug>/installations/new` when `github.appSlug` is set), `state` and
  any other value.
- The navbar shows on `/admin/**` (not the login page), and on public pages when a user is signed
  in. The user menu has Settings and Sign out.
- When the repo is public, the dashboard shows a warning: drafts are visible on GitHub.
- All text uses the keys `pluto.cms.*` in `i18n/locales/en.json` and `pt-BR.json`.

### What the tests cover

`test/cms-auth.test.ts` (flow, redirect check, session, refresh, re-check, logout, dev user),
`test/cms-origin.test.ts`, `test/cms-app-token.test.ts`, `test/cms-wiring.test.ts` (the adapter
registered as the Nitro plugin does it, anonymous 401, drafts hidden, a push user creates) and
`test/cms-module.test.ts`. The fixtures are `test/fixtures/fake-github.ts` (it also fakes `/user`,
`/repos/{o}/{r}`, the OAuth token endpoint and the App endpoints), `cms-auth-harness.ts` (an h3
app with a cookie jar), `cms-test-config.ts` and `kit-mock.ts`.

## GitHub App setup

1. Create a GitHub App (Settings, Developer settings, GitHub Apps).
2. Repository permissions: Contents read and write, Metadata read.
3. Callback URL: `<site>/api/_pluto/auth/github/callback`. Add one for local tests if needed.
4. Turn "Expire user authorization tokens" ON. The session refreshes tokens that expire.
5. Turn "Request user authorization (OAuth) during installation" OFF. Turn webhooks off.
6. Generate a client secret and a private key (PEM).
7. Install the App on the content repo only.
8. Set the env vars of the app:
   - `NUXT_PLUTO_CMS_SESSION_PASSWORD`: 32 characters or more, random.
   - `NUXT_PLUTO_CMS_GITHUB_APP_ID`
   - `NUXT_PLUTO_CMS_GITHUB_CLIENT_ID`
   - `NUXT_PLUTO_CMS_GITHUB_CLIENT_SECRET`
   - `NUXT_PLUTO_CMS_GITHUB_PRIVATE_KEY`: the PEM. Literal `\n` escapes are fine.
   - Optional `NUXT_PLUTO_CMS_GITHUB_READ_TOKEN`: a read-only token. It replaces the installation
     token for anonymous reads.
   - Optional `NUXT_PLUTO_CMS_ALLOWED_USERS`: GitHub logins, comma-separated, without case. When
     set, only these users can sign in, even with push access.
9. Set `plutoCms.github.repo` and, for the "not installed" link, `plutoCms.github.appSlug`.

A public repo shows its drafts on GitHub. Use a private repo for drafts.

For GitHub Enterprise Server, set `plutoCms.github.apiUrl` to `https://<host>/api/v3`. The OAuth
pages use `https://<host>`. Any other API URL uses `https://github.com`.

## Editor

The admin edits the body of a post with a Markdown editor. The widget is
`app/components/Pluto/Cms/PlutoFieldMarkdown.vue`. It is a `richtext` field widget. It follows
the widget contract of the content-model skill: the props `field`, `modelValue` and `disabled`,
and the event `update:modelValue`. `PlutoContentField` gives it the translated field text.

- It uses `UEditor` (Nuxt UI, Tiptap) with `content-type="markdown"`. The model value is a
  Markdown string. The editor sends `editor.getMarkdown()` on each change. The adapter stores that
  string as the file body.
- `UEditorToolbar` has the built-in items: undo, redo, headings 1 to 4, bulleted and numbered
  lists, quote, code block, bold, italic, strikethrough and inline code. The link button is a slot
  (`PlutoCmsEditorLink.vue`, a popover with the URL). The image and mention extensions are off.
- The editable area has a minimum height (`min-h-96`) in a bordered box with a sticky toolbar, so
  a click anywhere in the box puts the cursor in the text. The post type uses the focus layout
  with the full width.
- The text comes from `pluto.cms.editor.*` in `en.json` and `pt-BR.json`.
- The client plugin registers the widget as a `contentFieldWidgets` entry for
  `fieldType: 'richtext'`, in CMS mode only. It uses `defineAsyncComponent`, so Tiptap loads on the
  edit page only. Core has no `richtext` widget, so nothing else competes for the type.

Limits of the editor:

- The editor knows CommonMark and strikethrough. It has no node for a GFM table, a task list or raw
  HTML. A post that has them keeps the text, but the editor can lose the markup when it saves.
  The public page still renders tables and task lists from the stored Markdown.
- The editor can write the Markdown with other marks than the author used (for example `-`
  for a bullet). The text means the same.
- No test mounts the widget. The repo has no Vue component test setup.

## Public read

The public site reads published items with two routes, two composables and one component. A
public read is anonymous by design. The route marks the request anonymous (`markCmsAnonymous`)
before it reads. `getCmsAccess` then returns `null` and the session cookie is never opened. So
the answer is the same for every visitor, drafts never show (not even to a signed-in editor), and
the response never sets a cookie. The routes ignore every query key except `limit` and `offset`.
The module adds the routes only when the CMS is on. The origin check only blocks writes, so it
does nothing for these GET routes.

### Routes

- `GET /api/_pluto/cms/<type>`: the published items. `limit` is 1 to 100 (default 20). `offset`
  is 0 or more. A bad value uses the default. The answer is `{ data, total, limit, offset }`.
  An item has no body. It has `excerpt`: the `excerpt` field of the type when it has text, else
  `markdownToPlainText(body, 200)`. Items follow the `defaultSort` of the type.
- `GET /api/_pluto/cms/<type>/<slug>`: one published item and its body as `html` (rendered and
  sanitized).
- The type must be registered (404 if not). The slug goes through `assertSafeSlug` (400
  `pluto.cms.errors.invalidSlug`). A draft or a missing file gives 404.
- A success answer has `Cache-Control: public, s-maxage=<cache.publicMaxAge>,
  stale-while-revalidate=300`. An error answer has no public cache header.
- The logic is in `utils/public-content.ts` (`listPublicItems`, `getPublicItem`, `parsePaging`).
  The route files are thin.

### Rendering

`utils/markdown.ts` has `renderMarkdown(md)` and `markdownToPlainText(md, maxLength)`.
`renderMarkdown` uses `marked` with GFM. The `html` renderer returns an empty string, so raw HTML
in Markdown never reaches the output. Then `sanitizeHtml` runs on the result. The rendered HTML is
cached by blob id (`html:<oid>`, the `_version` of the item), and the fallback excerpt too
(`excerpt:<oid>`), through the cache of "Storage". A blob id never changes, so an entry never goes
stale.

`utils/sanitize-html.ts` is an allowlist sanitizer on `ultrahtml`. It is a port of
`richtext-sanitize.ts` of `@plutocms/supabase-blog`, with the same tests
(`test/cms-sanitize-html.test.ts`).

- Kept elements: `p h1-h6 strong b em i s del u code pre blockquote ul ol li hr br a img table thead
  tbody tr th td input`.
- Dropped with their children: `script style iframe object embed template noscript svg math link
  meta base form button select textarea audio video source track canvas applet frame frameset
  portal`. Any other element is unwrapped: the tag goes and the text stays.
- Kept attributes: `a`: `href`, `title`. `img`: `src`, `alt`, `title`, `width`, `height`. `code`: a
  `class` of the form `language-*`. `input`: only a checkbox, with `checked` and `disabled` as
  flags. `th` and `td`: `align` (left, center, right). Every other attribute goes, so `on*` and
  `style` go.
- URLs: no scheme (relative, `#`, `?`), `http:`, `https:` and `mailto:` pass. `data:` passes only
  for `image/png`, `jpeg`, `gif`, `webp` and `avif`. Other schemes go. The check decodes entities
  and strips control characters first, so `java&#115;cript:` fails. A bad `href` or `src` is
  removed and the element stays.
- Attribute values are escaped, so a quote cannot start a new attribute.
- The original sanitizer adds no `rel` or `target` to a link, and this port does the same.

### Composables

`runtime/app/composables/pluto-cms-content.ts` is in the auto-import dir. Both composables are
`useFetch` wrappers. They run on the server, so the page HTML holds the data.

- `usePlutoCmsList(type, { limit, offset } = {})`. The key is
  `pluto-cms-list:<type>:<limit>:<offset>`. It gives a `PlutoCmsListResult` of `PlutoCmsListItem`.
- `usePlutoCmsItem(type, slug)`. The key is `pluto-cms-item:<type>:<slug>`. It gives a
  `PlutoCmsItem` (the item plus `html`). A draft or a missing slug puts a 404 in `error`.
- The types are in `runtime/shared/public-types.ts`.

### `PlutoMarkdown`

`app/components/Pluto/Cms/PlutoMarkdown.vue`. Props: `html: string` and `tag = 'article'`. It sets
the server-sanitized HTML as `innerHTML`, with the same pattern as `PlutoProse` (a plain camelCase
`innerHTML` prop, not `v-html`, so SSR keeps it). It never parses Markdown on the client. The
typography is the base of the Nuxt UI editor theme (semantic tokens such as `text-highlighted` and
`border-default`), plus table styles. The module registers it with `addComponent`, because the
folder name would make the auto name `PlutoCmsPlutoMarkdown`. Pass only the `html` of a CMS item
to it.

Use on a site page:

```vue
<script setup lang="ts">
const route = useRoute()
const { data: post } = await usePlutoCmsItem('post', String(route.params.slug))
</script>
<template><PlutoMarkdown v-if="post" :html="post.html" /></template>
```

For a list page:

```vue
<script setup lang="ts">
const { data } = await usePlutoCmsList('post', { limit: 10 })
</script>
<template>
  <article v-for="post in data?.data" :key="post.id">
    <h2>{{ post.title }}</h2>
    <p>{{ post.excerpt }}</p>
  </article>
</template>
```

### What the tests cover

`test/cms-markdown.test.ts` (GFM, XSS vectors, plain text), `test/cms-sanitize-html.test.ts`
(the allowlist), `test/cms-public.test.ts` (drafts, excerpt, paging, 400 and 404, the cache
header, no cookie, anonymous with a session) and the new cases in `test/cms-module.test.ts` and
`test/pluto-cms-options.test.ts`.

## Status

All parts of v1 are built: the module, the stores, the Markdown content adapter, GitHub App
sign-in and the session, the editor, the public read routes, `PlutoMarkdown`, and the user docs
(the "Standalone mode" section of README.md). The starter is the `pluto-core-blog-template`
repository (`create-pluto -t core-blog`).

PKCE for GitHub App user tokens is sent but not proven against live GitHub yet. If GitHub
ignores the PKCE fields, `state` still guards the flow.

Planned for v2: media uploads, revision history, settings stored in the repository, a password
provider, GitHub App Manifest setup, scheduled posts, and configurable collections.

## Rules found in live testing

- **Admin layout.** In a supabase app, the supabase layer's `pages/admin.vue` parent route sets
  `layout: 'admin'`. The standalone CMS has no such route, so the module sets the `admin` layout
  on every `/admin/**` page (`applyAdminLayout` in `modules/pluto-cms/pages.ts`). A page that sets
  its own layout keeps it. `/admin/login` uses the `auth` layout.
- **The dev local user and `nuxt dev`.** `nuxt dev` proxies each request to its Nitro worker. The
  worker socket has no remote address, and the dev proxy appends the real client address as the
  LAST `x-forwarded-for` entry. `isLocalRequest` accepts that case only when the last entry is a
  loopback address and `Host` names this machine. A spoofed `x-forwarded-for` does not help a
  remote client: the proxy still appends its real address last.
- **The `fs` store head.** The store root is the project dir, so the head reads only the content
  dir (`headDir`). It never reads `node_modules`, build output or dot dirs. Reading the whole
  project on each request made the dev server stall.
