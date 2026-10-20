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

## Status

PR 2 (the module skeleton) is built. It only resolves options and writes the runtime config.
These parts are not built yet:

- PR 3: storage drivers (memory, fs, github) and the cache.
- PR 4: the Markdown content adapter.
- PR 5: auth (GitHub App sign-in, sealed session, origin check).
- PR 6: the editor, the public read routes and `PlutoMarkdown`.
- PR 7: user docs.
