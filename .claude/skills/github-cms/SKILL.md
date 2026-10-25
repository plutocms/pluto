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
- `runtime/app/{composables,plugins}/` — the client side.
- `app/components/Pluto/Cms/` — the sign-in form (`PlutoCmsSignIn`), the dashboard warning, the
  editor widget and `PlutoMarkdown`.
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
| `commit.skipDeploy` | `true` | Add `[skip ci]` to commit messages. A site that must redeploy on each edit (for example a docs site) sets it to `false`. See "Skip a deploy on Vercel". |
| `cache.headTtl` | `60` | Seconds. Zero or more. |
| `cache.storage` | `'cache'` | The Nitro storage mount for the cache. |
| `cache.publicMaxAge` | `60` | Seconds. Zero or more. The `s-maxage` of the public read routes. |
| `postType` | `true` | Register the fixed post content type, on the server and on the client. A layer that brings its own types sets it to `false`. |

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

- `store/types.ts` — the `PlutoCmsStore` contract: `head`, `listDir`, `listTree`, `readFile`, `commit`. A
  commit takes `expectedHeadOid`. A stale value throws `PlutoCmsConflictError`. PR 4 maps it to 409.
- `store/errors.ts` — `PlutoCmsStoreError` with a `code`: `conflict`, `auth`, `forbidden`,
  `rate-limit`, `not-found`, `github`. The code has no HTTP link. PR 4 maps it.
- `store/memory.ts` — an in-memory store for tests.
- `store/fs.ts` — a dev store over a local dir. The head is a hash of the file listing. It refuses
  any path outside the root.
- `store/github.ts` — `createGithubStore`. `head` uses the REST sha call with an ETag and a TTL.
  `listDir` is one GraphQL call. `listTree(dir, head, auth)` reads every `.md` file under a dir with
  one GraphQL call that nests `... on Tree { entries }` six levels deep. The cache key is
  `tree:<dir>@<head>`. The fs store reads the dir recursively. The memory store filters by path
  prefix. All three skip dot dirs and dot files. `commit` uses `createCommitOnBranch` and sets the cached head at once.
- `github/client.ts` — `githubRest` and `githubGraphql`. They take an injectable `fetch`
  transport. The default uses `ofetch`. They throw typed errors.
- `utils/cms-cache.ts` — the head with a TTL, the dir index by `<dir>@<headOid>`, parsed blobs by
  blob id, and single-flight. The backend is a Map by default.
  `utils/cms-cache-nitro.ts` gives a backend over Nitro `useStorage`.
- `utils/markdown-file.ts` — parse and write Markdown with YAML frontmatter. It uses the `yaml`
  core schema, so a tag never runs code.
- `utils/blob-sha.ts` — `gitBlobSha` and `listingOid`.
- `utils/cms-paths.ts` — `assertSafeSlug`, `assertSafeContentId`, `contentFilePath`,
  `contentDirPath` and `slugifyTitle`. The path helpers take `{ nested }` as the last argument.
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

### Nested content types

A type with `files: { nested: true }` stores its items in nested folders. A docs site needs this.
`files` is plain data and pure functions, so the type is safe on the server and on the client.
Only the file adapters read it.

```ts
files: {
  nested: true, // ids are paths: '1.start/2.install'
  exclude: ['index', 'drafts/'], // an id, or a folder with a trailing slash
  frontmatter: { read, write }, // pure (frontmatter) => frontmatter
}
```

- The id is the path under the type folder, without `.md`. Each segment is a slug with an optional
  numeric prefix (`^(?:\d+\.)?[a-z0-9]+(?:-[a-z0-9]+)*$`). An id has at most 6 segments and 255
  characters. `..`, an empty segment and a dot segment are refused. A flat type keeps the old rule
  (one slug) exactly.
- `source: ''` means the content dir itself. Only a nested type can use it.
- The adapter lists, gets, creates, updates and removes through `store.listTree`. The slug field
  holds the whole id, so a new path in the slug field creates the item in a folder. An update with
  a new path moves the file in one commit (add and delete). A move onto a taken path gives 409.
- The default sort of a nested type is `compareContentIds` (shared util, auto-imported): in each
  segment `index` comes first, then the numeric prefix as a number, then the name. Set
  `defaultSort: { field: 'id', direction: 'asc' }` for a nested type that also has timestamps.
- `frontmatter.read` runs on a copy after a file is parsed. Add the flat keys that the fields
  read, for example `navTitle` from `navigation.title`. A field that a hook maps is a normal field
  with that flat key as its `column`. `frontmatter.write` runs before a file is written. Fold the
  flat keys back and drop them. Keys that the type does not know must stay.
- The public read routes (`/api/_pluto/cms/:type/:slug`) take one segment. They do not read a
  nested item.

### No commit for an unchanged file

For every type, an update whose new file text equals the stored text makes no commit. The
`updated` timestamp alone does not count as a change. The call returns the stored item with the
same `_version`. A hand-written file with a different YAML layout is not equal, so the first real
save rewrites it.

### Push users

A user with push access gets the read, write, publish and delete capabilities of every registered
content type (`listContentTypes()`). The post type is the fallback when no type is registered.

The contract test suite is `test/contracts/content-adapter.contract.ts`
(`runContentAdapterContract`). Run it against any new adapter over the post type.
`test/cms-nested-adapter.test.ts` runs it on a nested type too.

## Wiring

When `plutoCms.enabled` is true, and only then, the module adds:

- Four server routes under `/api/_pluto/auth/` (see "Authentication").
- A server middleware, `middleware/pluto-cms-origin.ts`, for the CSRF check.
- A Nitro plugin, `plugins/pluto-cms.ts`. It picks the store (`github` with the Nitro cache, or `fs`
  rooted at the project dir in dev), registers the `post` type when `postType` is on, and registers
  the Markdown adapter. `getAccess(event)` gives the signed-in user (their GitHub token and
  capabilities) or `null`.
- A client plugin, `runtime/app/plugins/pluto-cms.ts`. It calls `definePlutoExtension` with the
  auth driver, the post content type, the post capabilities, the permissions driver and the
  public-repo dashboard widget. The post type and the post capabilities are registered only when
  `postType` is on (the module copies the option to `runtimeConfig.public.plutoCms.postType`; a
  missing value counts as on). The warning shows only when the repo is public and a registered type
  has a `status` (`showPublicRepoWarning`). Core loads the capabilities when the session appears.
- The auto-import dir `runtime/app/composables` (`usePlutoCmsSession`).

The module adds no page, no route middleware and no navbar. Core owns the `/admin` parent route,
the `/admin/login` page, the route guard and the navbar. The CMS is the reference auth driver.
See the [admin shell](../admin-shell/SKILL.md) skill.

The module puts the non-secret server settings in the private `runtimeConfig.plutoCms`: `apiUrl`,
`skipDeploy`, `headTtl`, `cacheStorage`, `postType`, `fsRoot`. `utils/cms-config.ts` reads all
config in one place (`getCmsConfig`). A test mocks that file.

The `fs` store root is the project dir (the same layout as the repo), so a post is at
`<project>/content/posts/<slug>.md`.

The Vue files are in `app/components/Pluto/Cms/`, because Tailwind scans the `app/` dir of a layer
only: `PlutoCmsSignIn` and `PlutoCmsPublicRepoWarning`. They use explicit imports for the session composable, so the type
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
- The auth driver (`id: 'pluto-cms-auth'`) maps the session: `user()` gives `id`, `name`, `username`
  (the GitHub login) and `avatarUrl`. `loggedIn()` reads `usePlutoCmsSession().loggedIn`. The
  session loads in the browser only, so `loggedIn()` is `false` on the server and in the first
  client render. This keeps the hydration stable. The navbar appears after hydration. `ready()`
  waits for the first session read, `refresh()` reads it again and `signOut()` posts to the logout
  route.
- Core's route guard sends a signed-out user on `/admin/**` (not `/admin/login`) to
  `/admin/login?redirect=<fullPath>`. A signed-in user on `/admin/login` goes to the redirect or to
  `/admin/home`. This is a UI guard only. The server checks every request.
- The login page is core's `/admin/login`. The driver gives the title and the description
  (`pluto.cms.login.*`) and the `signIn` component, `PlutoCmsSignIn`. It has one "Sign in with
  GitHub" button. It is a full page load to the login route. It shows an error for `forbidden`, `not_installed` (with a link to
  `https://github.com/apps/<appSlug>/installations/new` when `github.appSlug` is set), `state` and
  any other value.
- Core renders the navbar. It shows on `/admin/**` (not the login page), and on public pages for
  staff. The user menu has Settings and Sign out. In the local dev flow (`fs` store, local request)
  the dev user is signed in with no GitHub step, so the bar shows.
- A public layout that offsets its own header should use `usePlutoAdminBar().visible`. The core
  blog template still uses `usePlutoCmsSession().loggedIn` with `useMounted()`. It keeps working.
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

A public repo shows its drafts on GitHub. Use a private repo for drafts. The dashboard warns about
this only when a registered content type has a status (a type with no status has no drafts).

For GitHub Enterprise Server, set `plutoCms.github.apiUrl` to `https://<host>/api/v3`. The OAuth
pages use `https://<host>`. Any other API URL uses `https://github.com`.

### Skip a deploy on Vercel

`commit.skipDeploy` adds `[skip ci]` to the commit message. GitHub Actions and many CI tools read
that marker. Vercel does not read `[skip ci]` in a commit message. This is not confirmed by Vercel
docs: treat it as a rule of thumb and test it on your project. To skip a Vercel build, use an
Ignored Build Step script. It is a command that decides, from the project settings, whether
to build. A site that must deploy on each edit sets `commit.skipDeploy: false` and needs no script.

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

### Source mode

The widget has a Visual/Source switch. Source is `PlutoMarkdownSource`: a monospace textarea that
grows with the text, with `spellcheck="false"`. It never parses or rewrites the text.

- `PlutoTextField.editor?: 'auto' | 'visual' | 'source'` (a `richtext` field, default `auto`)
  picks the first mode. `visual` and `source` are fixed. `auto` opens Source when the text has
  syntax that the visual editor cannot keep. `pickMarkdownEditorMode(editor, text)` is the pure
  rule.
- `findUnsafeMarkdown(text)` (`shared/utils/markdown-syntax.ts`, auto-imported) lists that syntax,
  one issue `{ kind, line }` per kind: `mdc-block` (`::note`), `mdc-inline` (`:icon{}`,
  `:kbd[x]`), `attributes` (`](..){..}`, `]{..}`, and inline code followed by `{..}`), `html`,
  `table`, `task-list`, `footnote` and `fence-meta` (a code fence with more than a language). Text
  in a code fence or in inline code is ignored.
- The Visual button is off while the text has such syntax, with a tooltip
  (`pluto.cms.editor.unsafe`). It turns on again when the author removes the syntax in Source. An
  explicit `editor: 'visual'` still opens Visual: the author of the type owns that choice.
- `PlutoMarkdownSource` props: `modelValue`, `disabled`, `placeholder`, `rows` (18), `maxRows`,
  `ariaLabel`. Slot `toolbar` (slot props `insert`, `focus`). Exposed: `insert(text, { block })`
  (it replaces the selection and puts the caret after the text; `block` adds a blank line before
  and after) and `focus()`. `insertMarkdownText` is the pure helper. The CMS module registers the
  short name `PlutoMarkdownSource` (only when the CMS is on), the same way as `PlutoMarkdown`. A
  layer uses it to build its own field widget.
- i18n keys: `pluto.cms.editor.visual`, `source`, `unsafe`, `mode`.

Limits of the editor:

- The visual editor knows CommonMark and strikethrough. It has no node for MDC, a GFM table, a
  task list or raw HTML. Source mode is the way to edit a post that has them. The public page
  still renders tables and task lists from the stored Markdown.
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

- **Admin layout.** Core's `app/pages/admin.vue` parent route sets `layout: 'admin'` for every
  `/admin/**` page. The module sets no layout. `/admin/login` sets the `auth` layout itself. The
  login page path is `app/pages/admin/(auth)/login.vue`. The supabase layer ships the same path.
- **The dev local user and `nuxt dev`.** `nuxt dev` proxies each request to its Nitro worker. The
  worker socket has no remote address, and the dev proxy appends the real client address as the
  LAST `x-forwarded-for` entry. `isLocalRequest` accepts that case only when the last entry is a
  loopback address and `Host` names this machine. A spoofed `x-forwarded-for` does not help a
  remote client: the proxy still appends its real address last.
- **The `fs` store head.** The store root is the project dir, so the head reads only the content
  dir (`headDir`). It never reads `node_modules`, build output or dot dirs. Reading the whole
  project on each request made the dev server stall.
