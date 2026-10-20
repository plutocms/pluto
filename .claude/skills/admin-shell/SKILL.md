# Admin shell

Core owns the admin shell: the top navbar with the user menu. A backend layer does not write its
own navbar. It registers an auth driver, and core renders the navbar from it.

This file covers steps P1 (the contract) and P2 (the core navbar) of the "core-owned admin shell"
refactor. Step P3 (the core login page, the route guard and the `/admin` parent route) and step P4
(the CMS and supabase migration) come later. `publicPaths`, `signIn`, `signInTitle`,
`signInDescription` and `links` are in the contract now, but nothing renders them yet.

It extends the [extension registry](../extension-registry/SKILL.md).

## The auth driver

A layer sets `authDriver` in `definePlutoExtension`. The last registered driver wins, like the
other drivers. `PlutoAuthDriver` (in `shared/types/registry.ts`) has:

| Field | Purpose |
|---|---|
| `user()` | The signed-in `PlutoAuthUser` (`id`, `name`, `username`, `email`, `avatarUrl`), or `null`. |
| `loggedIn()` | Optional. Default is `user() !== null`. |
| `ready()` | A promise. It resolves after the first session check. It never rejects. |
| `refresh()` | Optional. Reads the session again. |
| `signOut()` | Ends the session. Core then shows a toast and goes to `/admin/login`. |
| `signIn` | The sign-in form component. Core passes `PlutoAuthSignInProps` (`redirect`). |
| `signInTitle`, `signInDescription` | Key-or-literal text for the login frame. |
| `links` | `signUp` and `forgotPassword` URLs. |
| `publicPaths` | Paths that need no sign-in. A string, or `{ path, signedIn: 'redirect' \| 'allow' }`. `/admin/login` is always one. |

`user` and `loggedIn` are getters, not refs. They read reactive state of the backend.

### The hydration rule

`loggedIn()` must give the same answer on the server and in the first client render.

- A backend with a cookie session that the server can read (supabase) can answer on the server.
  The navbar then renders in the server HTML.
- A backend that learns the session in the browser (the standalone CMS) answers `false` on the
  server. The navbar then appears after hydration.

Core adds no `ClientOnly` around the whole bar and uses no top-level await in it.

## Other buckets

| Field | Type | Purpose |
|---|---|---|
| `accountMenu` | `PlutoAccountMenuItem[]` | Items in the user menu. `label` is key-or-literal. Sorted by `order`. |
| `adminBanners` | `PlutoAdminBanner[]` | Banner components for the admin. Registered now. Nothing renders them yet. |
| `site` | `PlutoSiteInfo` | `name()` and `url()` of the public site. For each field, the last value wins. |

## Who sees the navbar

The rule is `navbarVisible` in `app/composables/internal/admin-shell.ts`. `usePlutoAdminBar()`
returns `{ visible }` with the same rule. An app that offsets its own header can use it.

- On `/admin/**`: any signed-in user, except on the public auth paths of the driver.
- On a public page: staff only. Staff is a user with at least one capability, or `*`. A shop
  customer (signed in, no capability) never sees the bar.
- With no permissions driver, every signed-in user counts as staff. This matches `can()`, which
  fails open.

### How the bar avoids a flash and a hydration mismatch

Capabilities load in the browser. `app/plugins/pluto-auth-sync.client.ts` watches `loggedIn`. On
sign-in it loads the capabilities and syncs the admin language. On sign-out it clears the
capabilities. It also sets `usePlutoCapabilitiesKnown()`, a state that is `true` only after the
capabilities loaded in the browser. The server never sets it.

- On a public page, the bar needs `capabilitiesKnown`. It is `false` on the server and in the
  first client render, so the server HTML and the first client render agree. There is no
  hydration mismatch.
- A customer never sees the bar, because the bar waits for the answer before it shows.
- On `/admin/**` the bar does not wait. It renders from `loggedIn()`.

The trade-off: on a public page, the bar appears after the capabilities load. It is never in the
first paint, even for a backend that can render it on the server. An app that offsets its own
header with `usePlutoAdminBar()` sees the same delay. If the load fails, the bar stays hidden.

## What the navbar has

`PlutoAdminNavbar` (in `app/components/Pluto/Admin/`) wraps the `PlutoNavbarAdmin` 40px bar. In
order:

1. The menu button, for small screens (`usePlutoAdminMenuOpen`).
2. The logo and the site name. The name is `site.name()`, else `runtimeConfig.public.websiteName`.
   It is hidden when empty or `Untitled`.
3. "View site", on `/admin/**` only. It opens `site.url()`, else `/`. The title is
   "Visit {domain}".
4. The navbar actions, inside `ClientOnly` with a spinner fallback.
5. The color mode button.
6. `PlutoAdminUserMenu`, only when a driver is registered.

The user menu has the avatar and the short name. The dropdown has a header (`Name (username)`),
Settings (`meta+,`), the `accountMenu` items, "Pluto on GitHub" (`plutocms/pluto`) and Sign out
(`meta+shift+q`). Shortcuts use `defineShortcuts(extractShortcuts(items))`.
`PlutoAdminNavbarProvider` shows the bar when `usePlutoAdminBar().visible` is true.

Texts are in `pluto.navbar.*`, in English and Brazilian Portuguese. The words are "Sign in",
"Sign out" and the default name "Account".

## Link actions

A `navbarActions` entry is a component action (`{ id, component }`) or a link action
(`PlutoNavbarLinkAction`): `{ id, label, icon?, to, target? }`. `to` can be a function. Core
renders a link action with `PlutoNavbarButton`: a ghost, neutral, small `UButton` with the icon.
The label shows from the lg breakpoint. Below it, the label is the aria-label. A component action
renders as before.

## The legacy shell fallback

If a layer registers its own navbar (the registry `navbar` field, or `useNavbarAdmin()` from
`@plutocms/utils`), `PlutoRoot` renders that navbar and not the core one. It logs one deprecation
warning in development. This keeps supabase 0.10 and the standalone CMS working until they move to
the auth driver. Remove the fallback, the `navbar` field and the `@plutocms/utils` bridge after
every layer migrates (step P4).

`PlutoRoot` shows the public-page admin menu (`PlutoNavbarAdminMenu`) whenever a bar shows on a
public page, core or legacy.

## Tests

- `test/admin-shell.test.ts` — paths, `safeRedirect`, `guardDecision`, `navbarVisible`, names.
- `test/auth-driver.test.ts` — `validatePlutoAuthDriver`, last driver wins, account menu order,
  site info.
