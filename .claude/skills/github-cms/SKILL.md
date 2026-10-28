# GitHub CMS

Pluto core gets an optional standalone CMS. Blog posts are Markdown files with YAML frontmatter in
a GitHub repo. Editors change them in the Pluto admin. The public site reads them live through the
GitHub API, with a cache. Users with push access to the repo are editors. They sign in with a
GitHub App. A draft is a post with `status: draft` in its frontmatter.

## On unless a backend layer is present

`plutoGithub.enabled` is `'auto'` by default. It also accepts `true` and `false`. When the CMS is
off, the `pluto-github` module adds nothing: no runtime config key, handler, plugin, page, middleware
or import.

- `'auto'`: on, unless a backend layer is present. With a backend layer it is off, with no log.
- `true`: on. With a backend layer, the module logs this error and stays off:

> The standalone CMS cannot run with the supabase layer. Remove plutoGithub.enabled or the supabase
> layer.

- `false`: off. The module returns before any other work.
- Any other value: the module logs an error and stays off.

A backend layer is any of these (`index.ts` checks them, then passes `hasBackendLayer` to
`resolvePlutoGithubOptions`):

- A layer with `$meta.name === 'supabase'`.
- The `@nuxtjs/supabase` module.
- A layer with `$meta.plutoBackend: true`. This is the generic marker. Nuxt keeps custom `$meta`
  keys in `layer.config`. A new backend layer sets it in its `nuxt.config.ts`.

A supabase app sees no change and no log line.

During `nuxt prepare`, an auto-enabled CMS logs no error. A build or a dev server logs it.

## Defaults

An explicit option always wins. `resolvePlutoGithubOptions(options, ctx)` is pure. The module passes
`ctx = { dev, hasBackendLayer, env: process.env, gitOrigin }`.

- `storage`: the env var `PLUTO_GITHUB_STORAGE`, else `fs` in dev and `github` in production.
- `github.repo`: the env var `NUXT_PLUTO_GITHUB_REPO`, then `PLUTO_GITHUB_REPO`, then Vercel's
  `VERCEL_GIT_REPO_OWNER` + `VERCEL_GIT_REPO_SLUG`, then (dev only) the `origin` remote of the
  git repo that holds `rootDir`.
- `github.appSlug`: `NUXT_PLUTO_GITHUB_APP_SLUG`, then `PLUTO_GITHUB_APP_SLUG`.
- `github.branch`: `main`.
- With the `github` storage and no repo, the module logs one error ("The standalone CMS needs a
  GitHub repo...") and stays off. It never throws.

`modules/pluto-github/git-remote.ts` has `parseGithubRepoUrl` (https, `git@`, `ssh://`, `git://` URLs
of github.com), `parseGitConfigOrigin` and `readGitOrigin`. `readGitOrigin` walks up from
`rootDir` to the `.git` dir, follows a worktree `gitdir:` pointer, and reads `config`. It runs
no shell command. Tests: `test/github-git-remote.test.ts`, `test/pluto-github-options.test.ts`.

## Files

- `modules/pluto-github/index.ts` — the Nuxt module (config key `plutoGithub`).
- `modules/pluto-github/git-remote.ts` — the git `origin` reader (Node `fs` only).
- `modules/pluto-github/options.ts` — pure helpers: `resolvePlutoGithubOptions`, `normalizeGithubDir`,
  `PLUTO_GITHUB_SECRET_ENV`. No Nuxt imports, so plain Vitest can test them.
- `shared/types/github.d.ts` — the `@nuxt/schema` types for `plutoGithub`.
- `test/pluto-github-options.test.ts` — the unit tests.
- `runtime/server/utils/{session,github-oauth,auth-flow,rate-limit,github-config,github-setup}.ts`,
  `runtime/server/github/app-token.ts`, `runtime/server/api/auth/**`,
  `runtime/server/plugins/pluto-github.ts` — the authentication and the wiring (see "Authentication"
  and "Wiring"). The CSRF check is in core (`server/utils/pluto-origin.ts`).
- `runtime/app/{composables,plugins}/` — the client side.
- `runtime/server/{api/build-status.get,utils/build-status}.ts`, `runtime/shared/{build-status,build-poller}.ts`,
  `runtime/app/composables/pluto-github-build-status.ts` and `app/components/Pluto/Github/PlutoGithubBuildStatus.vue` —
  the build status (see "Build status").
- `app/components/Pluto/Github/` — the sign-in form (`PlutoGithubSignIn`), the dashboard warning, the
  editor widget and `PlutoMarkdown`.
- `runtime/server/utils/{markdown,sanitize-html}.ts` and the adapter's `toPublic` — the public
  read side (see "Public read"). The routes are core's public API.

## Options

| Option | Default | Rule |
|---|---|---|
| `enabled` | `'auto'` | `'auto'`, `true` or `false`. See "On unless a backend layer is present". |
| `storage` | `'fs'` in dev, `'github'` in production | `'github'` or `'fs'`. `'fs'` is valid in dev only. |
| `github.repo` | found (see "Defaults") | `owner/name`. Required when storage is `github`. |
| `github.branch` | `'main'` | The branch to read and commit to. |
| `github.appSlug` | the env var, else `''` | The slug of the GitHub App. |
| `github.apiUrl` | `'https://api.github.com'` | The API base URL. |
| `dir` | `'content'` | Relative path. No `..`, no leading `/`, no drive letter. The module changes `\` to `/` and removes a trailing `/`. |
| `commit.skipDeploy` | `true` | Add `[skip ci]` to commit messages. A site that must redeploy on each edit (for example a docs site) sets it to `false`. See "Skip a deploy on Vercel". |
| `cache.headTtl` | `60` | Seconds. Zero or more. |
| `cache.storage` | `'cache'` | The Nitro storage mount for the cache. |
| `postType` | `true` | Register the fixed post content type, on the server and on the client. A layer that brings its own types sets it to `false`. |

A bad option turns the CMS off and logs an error. The module does not throw.

## Secrets

The secrets are run-time env vars. The module does not check them at build time. Set them as
`NUXT_PLUTO_GITHUB_<NAME>`, for example `NUXT_PLUTO_GITHUB_SESSION_PASSWORD`. The module puts an empty
string in `runtimeConfig.plutoGithub` for each one, so Nuxt can override it.

Required: `SESSION_PASSWORD`, `APP_ID`, `CLIENT_ID`, `CLIENT_SECRET`,
`PRIVATE_KEY`. Optional: `READ_TOKEN`, `ALLOWED_USERS`.

### Old env names (before 0.28)

Until 0.27 the env vars were `NUXT_PLUTO_CMS_*` and `PLUTO_CMS_*`. 0.28 read them as a fallback.
Pluto no longer reads them: a host that still has an old name has no value for the new one.
Test: `test/pluto-github-options.test.ts` ("old env names").

## Runtime config

When on, the module writes `runtimeConfig.plutoGithub` (the secrets) and
`runtimeConfig.public.plutoGithub` (`enabled`, `repo`, `branch`, `appSlug`, `storage`, `dir`, `postType`, `skipDeploy`).

## Storage

The storage layer is in `modules/pluto-github/runtime/server/`. The Nitro plugin wires it in (see
"Wiring"). Every runtime file uses explicit imports. The pure helpers run in plain Vitest.

- `store/types.ts` — the `PlutoGithubStore` contract: `head`, `listDir`, `listTree`, `readFile`, `commit`. A
  commit takes `expectedHeadOid`. A stale value throws `PlutoGithubConflictError`. PR 4 maps it to 409.
- `store/errors.ts` — `PlutoGithubStoreError` with a `code`: `conflict`, `auth`, `forbidden`,
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
- `utils/github-cache.ts` — the head with a TTL, the dir index by `<dir>@<headOid>`, parsed blobs by
  blob id, and single-flight. The backend is a Map by default.
  `utils/github-cache-nitro.ts` gives a backend over Nitro `useStorage`.
- `utils/markdown-file.ts` — parse and write Markdown with YAML frontmatter. It uses the `yaml`
  core schema, so a tag never runs code.
- `utils/blob-sha.ts` — `gitBlobSha` and `listingOid`.
- `utils/github-paths.ts` — `assertSafeSlug`, `assertSafeContentId`, `contentFilePath`,
  `contentDirPath` and `slugifyTitle`. The path helpers take `{ nested }` as the last argument.
- `test/fixtures/fake-github.ts` — an in-memory GitHub that counts calls by kind.

## Adapter

`runtime/server/adapter.ts` has `createMarkdownContentAdapter`. It is a `PlutoContentAdapter` over a
`PlutoGithubStore`. The Nitro plugin registers it (see "Wiring"). Options:
`store`, `dir`, `getAccess`, `commit.skipDeploy`, `cache`, `retries` (default 2).
`runtime/shared/post-type.ts` has `plutoGithubPostType`, the built-in `post` content type.

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
- `readFile(ctx, relativePath)` reads a raw file of the type folder (`{ text, version }`, `version` is
  the blob id). It works over the `github` and `fs` stores. `typeRelativePath` (`utils/github-paths.ts`)
  refuses `..`, absolute paths, drive letters, backslashes, `%`, control characters and empty or `.`
  segments (the adapter then returns `null`). A `.md` file follows the rules of `get` (usable id, visible).
  `get` adds `_frontmatter`: the whole frontmatter after the `read` hook.
- A layer that serves public pages calls the core util `markPublicRead(event)` (auto-imported;
  `markGithubAnonymous` is the same call inside the module). The test is `test/github-adapter-read-file.test.ts`.
- An anonymous caller sees published items only. This holds for `list`, `get` and `countCreated`,
  even when the query asks for drafts.
- A signed-in caller sees drafts only with the type read capability (`posts:read_drafts`). The
  capability `*` counts as every capability.
- Every write needs access (401). It needs the write or delete capability (403). A change of the
  published state needs the publish capability. `authorize` fails closed in the same way.

Conflict handling:

- An update with a stale `_version` gives 409 (`pluto.errors.conflict`). A missing `_version`
  skips this check.
- A create or rename to a taken slug gives 409 (`pluto.github.errors.slugTaken`).
- A rename is one commit: it adds the new path and deletes the old one.
- A commit uses a fresh head as `expectedHeadOid`. When the head is stale, the adapter retries up
  to 2 times, but only if the target file did not change. Otherwise it gives 409.
- Commit messages: `content(post): create "slug"`, `update`, `publish`, `unpublish`,
  `rename "a" -> "b"`, `delete`. `[skip ci]` is added when `skipDeploy` is on.

Store errors map to HTTP errors with `pluto.github.errors.*` keys: conflict 409, auth 401, forbidden
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
- The public API (`/api/pluto/v1/content/<type>/<id>`) takes the rest of the path as the id, so it
  reads a nested item too (each segment encoded on its own).

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
`test/github-nested-adapter.test.ts` runs it on a nested type too.

## Wiring

When the CMS is on (see "On unless a backend layer is present"), and only then, the module adds:

- Four server routes under `/api/_pluto/auth/` (see "Authentication").
- A Nitro plugin, `plugins/pluto-github.ts`. It picks the store (`github` with the Nitro cache, or `fs`
  rooted at the project dir in dev), registers the `post` type when `postType` is on, and registers
  the Markdown adapter. `getAccess(event)` gives the signed-in user (their GitHub token and
  capabilities) or `null`.
- A client plugin, `runtime/app/plugins/pluto-github.ts`. It calls `definePlutoExtension` with the
  auth driver, the post content type, the post capabilities, the permissions driver and the
  public-repo dashboard widget. The post type and the post capabilities are registered only when
  `postType` is on (the module copies the option to `runtimeConfig.public.plutoGithub.postType`; a
  missing value counts as on). The warning shows only when the repo is public and a registered type
  has a `status` (`showPublicRepoWarning`). Core loads the capabilities when the session appears.
- The auto-import dir `runtime/app/composables` (`usePlutoGithubSession`).

The module adds no page, no route middleware and no navbar. Core owns the `/admin` parent route,
the `/admin/login` page, the route guard and the navbar. The CMS is the reference auth driver.
See the [admin shell](../admin-shell/SKILL.md) skill.

The module puts the non-secret server settings in the private `runtimeConfig.plutoGithub`: `apiUrl`,
`skipDeploy`, `headTtl`, `cacheStorage`, `postType`, `fsRoot`. `utils/github-config.ts` reads all
config in one place (`getGithubConfig`). A test mocks that file.

The `fs` store root is the project dir (the same layout as the repo), so a post is at
`<project>/content/posts/<slug>.md`.

The Vue files are in `app/components/Pluto/Github/`, because Tailwind scans the `app/` dir of a layer
only: `PlutoGithubSignIn` and `PlutoGithubPublicRepoWarning`. They use explicit imports for the session composable, so the type
check works when the CMS is off.

## Authentication

A user signs in with a GitHub App (the user-to-server OAuth web flow). Only users with push access
to the content repo can sign in.

### Flow

1. `GET /api/_pluto/auth/github/login?redirect=/path`. The `redirect` must be a path on this site:
   one `/` at the start, not `//`, no `\`, no control character, no other origin. Any other value
   becomes `/admin/home`. The route makes `state` (32 random bytes, base64url) and a PKCE verifier.
   It saves `{ state, verifier, redirect }` in a separate sealed session, `pluto-github-oauth`, which
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

`utils/session.ts` uses h3 `useSession`. The cookie is `pluto-github-session`: sealed, httpOnly,
SameSite=Lax, Secure when not in dev, `maxAge` 7 days from the sign-in. A session header is off.
The password is `runtimeConfig.plutoGithub.sessionPassword` and needs 32 characters or more. In
production a missing or short password makes the sign-in routes answer 500
(`pluto.github.errors.authNotConfigured`) and logs one error. In dev it uses a random password for the
process, so a restart signs everyone out.

The cookie holds `{ user: { id, login, name, avatarUrl }, token, refreshToken, expiresAt,
refreshExpiresAt, permission, capabilities, checkedAt, repoPrivate }`. It is sealed, not stored on
the server, so a logout does not revoke a copy of the cookie. The token expiry and the permission
check below limit that.

Exports: `getGithubSession(event)`, `requireGithubSession(event)` (401
`pluto.github.errors.signInRequired`), `requireGithubCapability(event, cap)` (403), `setGithubSession`,
`clearGithubSession`. A request with no cookie reads as signed out and sets no cookie. Each request
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
  (`plutoGithubPostType.capabilities`: `posts:read_drafts`, `posts:publish`, `posts:delete`). The
  adapter and `requireGithubCapability` treat `*` as every capability. GitHub still enforces the real
  permission on each commit, because the commit uses the user token.
- Dev `fs` store: in dev with `storage: 'fs'`, a request from this machine gets a fixed user
  `local` with `['*']`. The check reads the socket address. A request is not local if it has
  `x-forwarded-for` or `forwarded`, or if its `Host` is not `localhost`, `127.0.0.1` or `[::1]`. So a
  tunnel or a DNS-rebinding page gets no access. Every other request is signed out.

### Anonymous reads

An anonymous caller sees published posts only. The store reads with a server token
(`github/app-token.ts`):

1. `runtimeConfig.plutoGithub.readToken` (a read-only token), when set.
2. Else an installation token of the App. The code signs an App JWT (RS256, `iat` now minus 60
   seconds, `exp` now plus 540 seconds, `iss` the app id). The private key may use literal `\n`
   escapes. It reads `GET /repos/{o}/{r}/installation`, then `POST
   /app/installations/{id}/access_tokens` for this repo with `contents: read`. It caches the token
   in memory until 5 minutes before it ends.
3. With neither set, an anonymous read answers 503 (`pluto.github.errors.githubUnavailable`) and logs
   the cause once. The server does not fail at boot.

A signed-in user reads and writes with their own token.

### CSRF

SameSite=Lax is the first guard. Core's server middleware `server/middleware/pluto-origin.ts` is the
second; it runs for every layer, with or without the CMS. For a request that
is not GET, HEAD or OPTIONS to `/api/_pluto/**`, the `Origin` header (or `Referer` when `Origin` is
absent) must have the same `host:port` as the `Host` header. A mismatch, a bad value such as
`Origin: null`, or no header at all gives 403 (`pluto.errors.crossOrigin`). The check uses the
`Host` header and ignores `x-forwarded-host`: Nitro has no setting that trusts a proxy, and a client
can fake that header. A proxy in front of the app must pass the public `Host` header. GET routes
never change state.

### Client

- `usePlutoGithubSession()` gives `{ user, capabilities, repo, loggedIn, status, ready, refresh,
  logout }`. It uses `useFetch` with the key `pluto-github-session` and `server: false`, so the
  server HTML of a public page never holds a user (a CDN may cache it). The admin is client-only.
- The auth driver (`id: 'pluto-github-auth'`) maps the session: `user()` gives `id`, `name`, `username`
  (the GitHub login) and `avatarUrl`. `loggedIn()` reads `usePlutoGithubSession().loggedIn`. The
  session loads in the browser only, so `loggedIn()` is `false` on the server and in the first
  client render. This keeps the hydration stable. The navbar appears after hydration. `ready()`
  waits for the first session read, `refresh()` reads it again and `signOut()` posts to the logout
  route.
- Core's route guard sends a signed-out user on `/admin/**` (not `/admin/login`) to
  `/admin/login?redirect=<fullPath>`. A signed-in user on `/admin/login` goes to the redirect or to
  `/admin/home`. This is a UI guard only. The server checks every request.
- The login page is core's `/admin/login`. The driver gives the title and the description
  (`pluto.github.login.*`) and the `signIn` component, `PlutoGithubSignIn`. It has one "Sign in with
  GitHub" button. It is a full page load to the login route. It shows an error for `forbidden`, `not_installed` (with a link to
  `https://github.com/apps/<appSlug>/installations/new` when `github.appSlug` is set), `state` and
  any other value.
- Core renders the navbar. It shows on `/admin/**` (not the login page), and on public pages for
  staff. The user menu has Settings and Sign out. In the local dev flow (`fs` store, local request)
  the dev user is signed in with no GitHub step, so the bar shows.
- A public layout that offsets its own header should use `usePlutoAdminBar().visible`. The core
  blog template still uses `usePlutoGithubSession().loggedIn` with `useMounted()`. It keeps working.
- When the repo is public, the dashboard shows a warning: drafts are visible on GitHub.
- All text uses the keys `pluto.github.*` in `i18n/locales/en.json` and `pt-BR.json`.

### What the tests cover

`test/github-auth.test.ts` (flow, redirect check, session, refresh, re-check, logout, dev user),
`test/github-origin.test.ts`, `test/github-app-token.test.ts`, `test/github-wiring.test.ts` (the adapter
registered as the Nitro plugin does it, anonymous 401, drafts hidden, a push user creates) and
`test/github-module.test.ts`. The fixtures are `test/fixtures/fake-github.ts` (it also fakes `/user`,
`/repos/{o}/{r}`, the OAuth token endpoint and the App endpoints), `github-auth-harness.ts` (an h3
app with a cookie jar), `github-test-config.ts` and `kit-mock.ts`.

## GitHub App setup

This is the manual path. The site can create the App for you: see "Setup from the site".

1. Create a GitHub App (Settings, Developer settings, GitHub Apps).
2. Repository permissions: Contents read and write, Metadata read. For the build status of the edit form also: Checks read, Commit statuses read, Deployments read.
3. Callback URL: `<site>/api/_pluto/auth/github/callback`. Add one for local tests if needed.
4. Turn "Expire user authorization tokens" ON. The session refreshes tokens that expire.
5. Turn "Request user authorization (OAuth) during installation" OFF. Turn webhooks off.
6. Generate a client secret and a private key (PEM).
7. Install the App on the content repo only.
8. Set the env vars of the app:
   - `NUXT_PLUTO_GITHUB_SESSION_PASSWORD`: 32 characters or more, random.
   - `NUXT_PLUTO_GITHUB_APP_ID`
   - `NUXT_PLUTO_GITHUB_CLIENT_ID`
   - `NUXT_PLUTO_GITHUB_CLIENT_SECRET`
   - `NUXT_PLUTO_GITHUB_PRIVATE_KEY`: the PEM, a PEM with literal `\n` escapes, or the base64 of the PEM.
   - Optional `NUXT_PLUTO_GITHUB_READ_TOKEN`: a read-only token. It replaces the installation
     token for anonymous reads.
   - Optional `NUXT_PLUTO_GITHUB_ALLOWED_USERS`: GitHub logins, comma-separated, without case. When
     set, only these users can sign in, even with push access.
9. Set `PLUTO_GITHUB_REPO` (or `plutoGithub.github.repo`) when the default does not find the repo. For the "not installed" link, set `PLUTO_GITHUB_APP_SLUG` (or `plutoGithub.github.appSlug`).

A public repo shows its drafts on GitHub. Use a private repo for drafts. The dashboard warns about
this only when a registered content type has a status (a type with no status has no drafts).

For GitHub Enterprise Server, set `plutoGithub.github.apiUrl` to `https://<host>/api/v3`. The OAuth
pages use `https://<host>`. Any other API URL uses `https://github.com`.

### Skip a deploy on Vercel

`commit.skipDeploy` adds `[skip ci]` to the commit message. GitHub Actions and many CI tools read
that marker. Vercel does not read `[skip ci]` in a commit message. This is not confirmed by Vercel
docs: treat it as a rule of thumb and test it on your project. To skip a Vercel build, use an
Ignored Build Step script. It is a command that decides, from the project settings, whether
to build. A site that must deploy on each edit sets `commit.skipDeploy: false` and needs no script.

## Setup from the site

The author creates the GitHub App from the site, with the GitHub App Manifest flow. No manual form
and no copy of five secrets. The manual steps of "GitHub App setup" stay as the fallback.

### Routes

All routes are GET, under `/api/_pluto/github/setup/`. The module adds them when the CMS is on. They use the same
rate limit as the sign-in routes (20 a minute for each IP) and send `Cache-Control: no-store`.

- `status`: `{ ready: true }` for an anonymous caller of a site that is set up. `ready` needs the
  app id, the client id, the client secret, a private key that parses and a session password of 32
  characters or more. A caller that may see more gets
  `{ ready, repo, storage, callbackUrl, canCreateApp, checks: [{ id, ok }] }`: the dev local
  request, a signed-in user, and anyone while `ready` is false (the login page needs it). The check
  ids are `repo`, `sessionPassword`, `appId`, `clientId`, `clientSecret`, `privateKey` and
  `installation`. `installation` runs only when the repo, the app id and the key are fine: it signs
  an App JWT and reads `GET /repos/{repo}/installation`. `repo` is not part of `ready`. The answer
  holds booleans and public names only, never a secret.
- `github/start`: answers an HTML page with a form that posts the manifest to GitHub. The form
  submits itself, and has a button for a browser without JavaScript. The form action is
  `https://github.com/settings/apps/new?state=<state>` for a user owner and
  `https://github.com/organizations/<org>/settings/apps/new?state=<state>` for an organization
  (`GET /users/<owner>` gives the `type`; a failed lookup counts as a user). GitHub Enterprise Server
  uses the host of `github.apiUrl` (`oauthBaseUrl`). `state` is random. It goes in the plain cookie
  `pluto-github-setup` (httpOnly, SameSite=Lax, 10 minutes, path `/api/_pluto/github/setup`, Secure on
  https). It is not the sealed session: in production the session password may not exist yet.
- `github/callback?code&state`: compares `state` with the cookie in constant time, and clears the
  cookie first (the state works once). Then it sends `POST <apiUrl>/app-manifests/{code}/conversions`
  with no auth and answers a server-rendered HTML page. A bad `state` or `code` gives 400 and a
  failed conversion gives 502, both with a page that links to `start`. Nothing is stored. The
  secrets go only to the browser that ran the flow, and no log holds a value.

The origin of the site is `getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin`.

### Who can run it

`start` and `callback` run for the dev local request (`import.meta.dev` and `isLocalRequest`, the rule
of the dev local user), or for any request while `ready` is false. When the site is set up, in
production, both answer 404. The secrets only go to the browser that runs the flow.

### The manifest

`buildAppManifest` (in `utils/github-app-setup.ts`) builds it:

- `name`: "<site name> CMS", 34 characters or less. The site name is `public.websiteName`, else the
  repo name. The author can change it on GitHub.
- `url`: the origin. `hook_attributes`: `{ url: origin, active: false }`.
- `redirect_url`: `<origin>/api/_pluto/github/setup/callback`.
- `callback_urls`: `<origin>/api/_pluto/auth/github/callback`, plus
  `http://localhost:3000/api/_pluto/auth/github/callback` when the origin is not local.
- `public: false`, `default_permissions: { contents: 'write', metadata: 'read', checks: 'read', statuses: 'read', deployments: 'read' }`,
  `default_events: []`, `request_oauth_on_install: false`.

### The result page

The page has the env block in a textarea with a Copy button, the install link
(`https://github.com/apps/<slug>/installations/new`) and the next steps. The block has
`NUXT_PLUTO_GITHUB_APP_ID`, `NUXT_PLUTO_GITHUB_CLIENT_ID`,
`NUXT_PLUTO_GITHUB_CLIENT_SECRET`, `NUXT_PLUTO_GITHUB_PRIVATE_KEY` (the base64 of the PEM, on
one line), `PLUTO_GITHUB_APP_SLUG`, and `NUXT_PLUTO_GITHUB_SESSION_PASSWORD` (new random) when the site has
no valid one. The pages are plain HTML with inline CSS, light and dark with `prefers-color-scheme`.
They use the server translator (`usePlutoServerTranslator`) with the first tag of `Accept-Language`
(`pluto.github.setup.page.*`).

In development (the dev local request), the route also writes the values into `<rootDir>/.env`:
`updateEnvText` replaces a key that exists, appends the others, keeps the other lines and their
order, and handles a multi-line quoted value. The page says so, and warns when `.gitignore` does not
ignore `.env`. If the write fails, the page tells the author to copy the block. The module gives
`runtimeConfig.plutoGithub.rootDir` in development only. `PLUTO_GITHUB_APP_SLUG` is read when Nuxt starts,
so a dev server needs a restart.

### Private key formats

`normalizePem` (`github/app-token.ts`) accepts a PEM with real line breaks, a PEM with literal `\n`
and the base64 of the PEM (no `-----BEGIN` in the value: it decodes, and uses the result when it has
`-----BEGIN`).

### In the admin

- The login card (`PlutoGithubSignIn`): when the status says `ready: false`, it shows
  `PlutoGithubSetupPanel` (a warning, the checklist with a short fix for each missing item, the
  **Create the GitHub App** button when `canCreateApp`, an **Install the App** link when the
  installation check fails and the slug is known, and a link to the quickstart). The Sign in button
  is disabled while `ready` is false. A failed status read keeps it on.
- The **GitHub** tab of Settings: `/admin/settings/github`. The `settingsPages` entry (id `github`,
  order 150, no capability) is in the CMS client plugin. The module adds the route with
  `extendPages`, as a child of `settings`, from `app/components/Pluto/Github/PlutoGithubSettingsPage.vue`.
  It shows the same checklist, the callback URL to use (with a Copy button) and the Create button.
- `usePlutoGithubSetup()` (`runtime/app/composables/pluto-github-setup.ts`) reads the status after
  hydration (`server: false`, key `pluto-github-setup`).

### Files and tests

- `utils/github-app-setup.ts`: the pure helpers (manifest, form action, conversion parser, env
  entries and block, `.env` updater, `.gitignore` check, key check, setup checks).
- `utils/github-setup-pages.ts`: the pure HTML pages (`escapeHtml`, start, result, error).
- `utils/github-setup-flow.ts`: the handlers (access rule, status, start, callback, `.env` write).
- `api/setup/status.get.ts`, `api/setup/start.get.ts`, `api/setup/callback.get.ts`.
- Tests: `test/github-app-setup.test.ts` (pure helpers), `test/github-setup.test.ts` (the routes with
  the real locale files), and the key formats in `test/github-app-token.test.ts`.

## Editor

The admin edits the body of a post with a Markdown editor. The widget is
`app/components/Pluto/Github/PlutoFieldMarkdown.vue`. It is a `richtext` field widget. It follows
the widget contract of the content-model skill: the props `field`, `modelValue` and `disabled`,
and the event `update:modelValue`. `PlutoContentField` gives it the translated field text.

- It uses `UEditor` (Nuxt UI, Tiptap) with `content-type="markdown"`. The model value is a
  Markdown string. The editor sends `editor.getMarkdown()` on each change. The adapter stores that
  string as the file body.
- `UEditorToolbar` has the built-in items: undo, redo, headings 1 to 4, bulleted and numbered
  lists, quote, code block, bold, italic, strikethrough and inline code. The items come from
  `usePlutoMarkdownToolbar({ link })` (`app/composables/pluto-markdown-toolbar.ts`), so another
  editor can share them. The link button is a slot
  (`PlutoGithubEditorLink.vue`, a popover with the URL). The image and mention extensions are off.
- The editable area has a minimum height (`min-h-96`) in a bordered box with a sticky toolbar, so
  a click anywhere in the box puts the cursor in the text. The post type uses the focus layout
  with the full width.
- The text comes from `pluto.github.editor.*` in `en.json` and `pt-BR.json`.
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
  (`pluto.github.editor.unsafe`). It turns on again when the author removes the syntax in Source. An
  explicit `editor: 'visual'` still opens Visual: the author of the type owns that choice.
- `PlutoMarkdownSource` props: `modelValue`, `disabled`, `placeholder`, `rows` (18), `maxRows`,
  `ariaLabel`. Slot `toolbar` (slot props `insert`, `focus`). Exposed: `insert(text, { block })`
  (it replaces the selection and puts the caret after the text; `block` adds a blank line before
  and after) and `focus()`. `insertMarkdownText` is the pure helper. The CMS module registers the
  short name `PlutoMarkdownSource` (only when the CMS is on), the same way as `PlutoMarkdown`. A
  layer uses it to build its own field widget.
- i18n keys: `pluto.github.editor.visual`, `source`, `unsafe`, `mode`.

Limits of the editor:

- The visual editor knows CommonMark and strikethrough. It has no node for MDC, a GFM table, a
  task list or raw HTML. Source mode is the way to edit a post that has them. The public page
  still renders tables and task lists from the stored Markdown.
- The editor can write the Markdown with other marks than the author used (for example `-`
  for a bullet). The text means the same.
- No test mounts the widget. The repo has no Vue component test setup.

## Public read

The public site reads published posts through core's public API: `GET /api/pluto/v1/content/post`
and `GET /api/pluto/v1/content/post/<slug>`, with `usePlutoPublicList` and `usePlutoPublicItem`.
See "The public API" in the content-model skill for the routes, the query, the answer, the cache
and CORS. The post type sets `api: { public: true }`. A public read is anonymous by design: core
calls `markPublicRead` (the same mark as `markGithubAnonymous`) before it reads. `getGithubAccess` then
returns `null` and the session cookie is never opened. So the answer is the same for every visitor,
drafts never show (not even to a signed-in editor), and the response never sets a cookie.

### What the Markdown adapter adds

The adapter implements `timestampKeys` (the `createdAt`, `updatedAt` and `publishedAt` frontmatter
keys of the type) and `toPublic`:

- A list item has no body. It has `excerpt`: the `excerpt` value of the item when it has text, else
  `markdownToPlainText(body, 200)`.
- One item keeps the Markdown body and adds `html`: the body rendered and sanitized.
- `list` applies `query.filters` by the text of each item value.

Every CMS type gets this, also the docs types of the Nuxt Content layer.

### Rendering

`utils/markdown.ts` has `renderMarkdown(md)`, `markdownToPlainText(md, maxLength)` and `stripMdc(md)`.
`renderMarkdown` first runs `stripMdc`: the MDC syntax of Nuxt Content goes (`::name` and `::` lines, the
YAML props block right after an open line, `#slot` lines inside a component, inline `:component{…}`, and
`{…}` attributes after a span or a link) and the text stays, so a docs page has clean `html` and a clean
`excerpt` on the public API. Code in a fence does not change. A heading needs a space after `#`, so a
`#slot` line never looks like one.
`renderMarkdown` uses `marked` with GFM. The `html` renderer returns an empty string, so raw HTML
in Markdown never reaches the output. Then `sanitizeHtml` runs on the result. The rendered HTML is
cached by blob id (`html:<oid>`, the `_version` of the item), and the fallback excerpt too
(`excerpt:<oid>`), through the cache of "Storage". A blob id never changes, so an entry never goes
stale.

`utils/sanitize-html.ts` is an allowlist sanitizer on `ultrahtml`. It is a port of
`richtext-sanitize.ts` of `@plutocms/supabase-blog`, with the same tests
(`test/github-sanitize-html.test.ts`).

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

### `PlutoMarkdown`

`app/components/Pluto/Github/PlutoMarkdown.vue`. Props: `html: string` and `tag = 'article'`. It sets
the server-sanitized HTML as `innerHTML`, with the same pattern as `PlutoProse` (a plain camelCase
`innerHTML` prop, not `v-html`, so SSR keeps it). It never parses Markdown on the client. The
typography is the base of the Nuxt UI editor theme (semantic tokens such as `text-highlighted` and
`border-default`), plus table styles. The module registers it with `addComponent`, because the
folder name would make the auto name `PlutoGithubPlutoMarkdown`. Pass only the `html` of a CMS item
to it.

Use on a site page:

```vue
<script setup lang="ts">
const route = useRoute()
const { data } = await usePlutoPublicItem<{ title: string, html: string }>('post', String(route.params.slug))
</script>
<template><PlutoMarkdown v-if="data" :html="data.data.html" /></template>
```

For a list page:

```vue
<script setup lang="ts">
const { data } = await usePlutoPublicList('post', { limit: 10 })
</script>
<template>
  <article v-for="post in data?.data" :key="post.id">
    <h2>{{ post.title }}</h2>
    <p>{{ post.excerpt }}</p>
  </article>
</template>
```

### What the tests cover

`test/github-markdown.test.ts` (GFM, XSS vectors, plain text), `test/github-sanitize-html.test.ts`
(the allowlist), `test/github-public.test.ts` (the posts through the public API: drafts, excerpt,
paging, sort, filters, 400 and 404, the cache header, no cookie, anonymous with a session) and
`test/github-module.test.ts` (no public route and no middleware in the module).

## Build status

After a save, the site can take some minutes to change. The edit form shows the build of the head
commit of the content branch, next to the Save button. It shows only for GitHub storage with
`commit.skipDeploy` false (a save then starts a deploy). With the `fs` store, or with
`skipDeploy` on, nothing shows. The module copies `skipDeploy` to `runtimeConfig.public.plutoGithub`,
and `showBuildStatus` (`runtime/shared/client-rules.ts`) is the test.

### Route

`GET /api/_pluto/github/build-status`. It needs a signed-in user (401 otherwise)
and reads with the token of that user. The answer has `Cache-Control: no-store`. The `fs` store
answers `none` with no GitHub call.

It reads the commit (`GET /repos/{repo}/commits/{branch}`: sha, message, date). Then, for that sha,
three sources at the same time:

- check runs (`/commits/{sha}/check-runs`): GitHub Actions and apps. `html_url` is the Action run.
- commit statuses (`/commits/{sha}/status`): for example Vercel. `target_url` is the build page.
- deployments (`/deployments?sha=`), the newest of each environment, and the latest status of each
  one (`/deployments/{id}/statuses?per_page=1`). At most 5 environments.

The sources of one user and sha stay in memory for 3 seconds, so several tabs share the calls. A
403 or 404 on a source means that the App cannot read it. The source is skipped and its kind is in
`unavailable`. A GitHub rate limit gives 503 with `Retry-After`, a rejected token 401, any other
failure 502 (the same `pluto.github.errors.*` keys as the adapter).

The answer (`PlutoBuildStatus`, `runtime/shared/build-status.ts`):

```ts
{ sha, shortSha, message /* first line */, committedAt?, state: 'none' | 'pending' | 'success' | 'failure',
  items: [{ kind: 'check' | 'status' | 'deployment', name, state: 'pending' | 'success' | 'failure',
            url?, startedAt?, completedAt?, description? }],
  unavailable?: ('check' | 'status' | 'deployment')[] }
```

### The reducer

`reduceBuildStatus({ checkRuns, statuses, deployments })` is pure (`runtime/shared/build-status.ts`).

- Check run: not `completed` is pending. `success`, `neutral` and `skipped` are a success. Every
  other conclusion (`failure`, `cancelled`, `timed_out`, `action_required`, `stale`) is a failure.
- Commit status: `success`, `pending`, and `failure` or `error` (a failure). Unknown is pending.
- Deployment: `success` and `inactive` are a success. `failure` and `error` fail. `queued`,
  `pending`, `in_progress` and a deployment with no status yet are pending.
- Commit state: `none` with no item. `pending` while any item is pending (even if another failed).
  Else `failure` when any item failed. Else `success`.
- `url` keeps an `http` or `https` URL only.

### The item in the toolbar

`app/components/Pluto/Github/PlutoGithubBuildStatus.vue` is a `contentToolbarItems` entry with
`contentType: '*'` and `order: 50` (see the admin-view-chrome skill). The CMS client plugin
registers it, lazy, only when `showBuildStatus` is true.

- A type with `liveOnSave` (see the content-model skill) shows a save at once: after a save the item
  shows the check and "Live" without waiting for the first answer. While the state is `pending` a
  small spinner shows by the Info button, and the popover says "Static build in progress". When the
  build fails, the item keeps "Live", the Info icon gets a warning tint, and the popover says "The
  static build failed. The site serves the change at run time until a build passes." On open, the item
  shows "Live" once the status is known. Without `liveOnSave` nothing changes.
- Pending: a spinner and "Publishing…". Success: a check mark and "Live". Failure: an error icon
  and "Build failed". `none`, and a failed read: nothing. The text hides below `md`.
- The Info button opens a popover (`UPopover`): the commit (short sha, message, time) and each
  item with its state, time, description and a link button ("View the Action" for a check run,
  "View the build" for a status or a deployment). `unavailable` adds a hint about the App
  permissions.
- Polling (`createBuildPoller`, `runtime/shared/build-poller.ts`, with the rules in `shouldPoll`):
  one read when the edit page opens and after each save (`usePlutoContentForm().onSaved`, which
  forgets the old answer first). Then every 5 seconds while the state is `pending`. It stops when
  the state is final, after 15 minutes, and while the page is hidden (it reads again when the page
  shows). After a save, `none` is not final for 60 seconds, because GitHub needs some seconds to
  create the checks. Errors back off (10 s, 20 s, up to 60 s). It stops on 401 or 403, and after 5
  errors in a row.
- `usePlutoGithubBuildStatus()` (`runtime/app/composables/pluto-github-build-status.ts`) holds the state
  for one component: `status`, `failed`, `check()`, `afterSave()`, `stop()`.

### GitHub App permissions

The App needs read access to **Checks**, **Commit statuses** and **Deployments**. The App manifest
of the setup flow asks for them (`checks`, `statuses`, `deployments`: `read`). An App that was
created before this feature lacks them: GitHub answers 403, the sources are `unavailable`, and no
item shows. Add the three permissions in the App settings, and accept them on the installation.

### Tests

`test/github-build-status.test.ts` (reducer, URL and headline helpers, `shouldPoll`,
`showBuildStatus`), `test/github-build-poller.test.ts` (the loop, with fake timers) and
`test/github-build-status-route.test.ts` (the route with a fake GitHub).

## Status

All parts of v1 are built: the module, the stores, the Markdown content adapter, GitHub App
sign-in and the session, the editor, the public read routes, `PlutoMarkdown`, and the user docs
(the "Standalone mode" section of README.md). The starter is the `pluto-core-blog-template`
repository (`create-pluto -t core-blog`).

PKCE for GitHub App user tokens is sent but not proven against live GitHub yet. If GitHub
ignores the PKCE fields, `state` still guards the flow.

The GitHub App can be created from the site (see "Setup from the site").

Planned for v2: media uploads, revision history, settings stored in the repository, a password
provider, scheduled posts, and configurable collections.

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
