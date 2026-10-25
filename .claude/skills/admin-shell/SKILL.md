# Admin shell

Core owns the admin shell: the `/admin` parent route, the login page, the route guard, the admin
banners, and the top navbar with the user menu. A backend layer does not write these. It registers
an auth driver, and core renders the shell from it.

This file covers steps P1 (the contract), P2 (the core navbar), P3 (the routes and the guard) and
P4 (the standalone CMS as the reference driver) of the "core-owned admin shell" refactor. The
supabase layer migrates later. See "Migrating a backend to the auth driver".

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
| `adminBanners` | `PlutoAdminBanner[]` | Banner components for the admin. The admin layout renders them. See "Admin banners". |
| `site` | `PlutoSiteInfo` | `name()` and `url()` of the public site. For each field, the last value wins. |

## Routes

| File | Route | Purpose |
|---|---|---|
| `app/pages/admin.vue` | `/admin` (parent) | `definePageMeta({ layout: 'admin' })` and `<NuxtPage />`. Every `/admin/**` page is a child. |
| `app/pages/admin/(auth)/login.vue` | `/admin/login` | The login page. It sets the `auth` layout and renders `PlutoAdminAuthCard`. |
| `app/pages/admin/no-access.vue` | `/admin/no-access` | The page for a signed-in user with no capability. It uses the `auth` layout. See "The staff step". |

A child that must not use the admin layout (the auth pages) sets its own layout in
`definePageMeta`. The `(auth)` folder is a route group: it adds no path segment.

The file paths are the contract. The supabase layer 0.10 ships the same paths, so in a supabase app
its files override core's files. This is intended until supabase migrates. A different path for
the login page would give two `/admin/login` routes in a supabase app.

`/admin` redirects to `/admin/home` with the core `routeRules` entry in `nuxt.config.ts`, and
`/admin/**` has `ssr: false`. The admin is client-only, so the guard below runs in the browser for
these paths.

## The route guard

`app/middleware/pluto-admin-auth.global.ts` is a global route middleware.

1. With no auth driver, it does nothing. A backend with its own guard (supabase 0.10, with its own
   `auth` middleware) is not affected.
2. It never touches a path outside `/admin`.
3. It awaits `driver.ready()`. A rejection counts as signed out.
4. It calls `driver.guard(to)` when the driver has one. A returned local path that is not the
   current path is a redirect. Nothing returned, or a rejection, goes on to the next step. Supabase
   uses this hook to send a new install to `/admin/setup` before the sign-in rule.
5. It calls `guardDecision` with `normalizePublicPaths(driver.publicPaths)`. On a redirect, it calls
   `navigateTo(to, { replace: true })`.

6. The staff step (see below). It runs only for a signed-in user on a private admin path.

A signed-out user on a private admin path goes to `/admin/login?redirect=<fullPath>`. A signed-in
user on a public auth path goes to the checked `redirect` target, or to `/admin/home`. The server
still checks every request. The guard only decides what the browser shows.

## The staff step

Only staff can enter the private admin pages. Staff is a user with at least one capability (an
admin holds `*`). With no permissions driver, every signed-in user counts as staff, like `can()`
that fails open. The rule is `isStaff(hasDriver, granted)` in `internal/admin-shell.ts`. The navbar
uses the same function. The server RLS uses the same meaning (`my_capabilities()` is not empty).

After `guardDecision` allows a signed-in user, the middleware awaits
`usePlutoPermissions().ensureLoaded(userId)` and calls the pure `staffDecision`:

- A path outside `/admin`, and a public auth path of the driver: allow. They are never checked.
- Staff on a private path: allow.
- No capability: go to `/admin/no-access?redirect=<fullPath>`.
- The capabilities failed to load: go to `/admin/no-access?reason=error&redirect=<fullPath>`.
- On `/admin/no-access`: staff go to the checked `redirect` target, or to `/admin/home`. A user who
  is not staff stays. This keeps the guard free of a redirect loop.

The auth sync plugin and the middleware both ask for the same list. `ensureLoaded` shares one
request between them, so there is no race. A GitHub CMS app is not affected: every CMS user has
capabilities.

`navbarVisible` hides the bar on `/admin/**` when the capabilities are known and the user is not
staff. So the no-access page has no admin bar.

### The no-access page

`/admin/no-access` uses the `auth` layout and `PlutoAdminAuthCard`. It shows "Your account has
no access to the admin", or an error text for `reason=error`. It has three actions:

- Try again: clears the capabilities, loads them again, then goes to `redirect` or `/admin/home`
  for staff. A user who is still not staff stays.
- Go to the site: `/`.
- Sign out: `usePlutoAuth().signOut()`.

The texts are in `pluto.noAccess.*`, in English and Brazilian Portuguese. The tab title is the
heading.

## The login frame

`PlutoAdminAuthCard` (`app/components/Pluto/Admin/PlutoAdminAuthCard.vue`) is the frame of the login
page. The name follows the folder rule of Nuxt: a file `PlutoAuthCard.vue` in `Admin/` would be
`PlutoAdminPlutoAuthCard`. The card has:

- The logo and the site name (`site.name()`, else `websiteName`, hidden when `Untitled`).
- The heading: `signInTitle` (key-or-literal), default "Sign in". The description is
  `signInDescription`.
- The `signIn` component of the driver, with the prop `redirect`. The login page gives it
  `safeRedirect(route.query.redirect)`: a local path or an empty string.
- The footer links `links.signUp` and `links.forgotPassword`, when the driver gives them.
- A "Back to the site" link.

The card also frames the other auth pages of a backend (sign up, password reset). Give it a
default slot, and the slot replaces the driver's form and links. The props `title` and
`description` (key-or-literal) replace the heading. Example:

```vue
<PlutoAdminAuthCard title="supabase.auth.signup.title">
  <SignUpForm />
</PlutoAdminAuthCard>
```

With no driver and no slot, the card shows an alert: no sign-in method is set up. The texts are in
`pluto.auth.*`, in English and Brazilian Portuguese.

## Admin banners

The admin layout renders the `adminBanners` bucket, sorted by `order`, at the top of the page
content. They are below the fixed navbar and above the page. A banner is a component with no props.
It decides for itself if it shows.

## The CMS as the reference driver

The standalone CMS (`modules/pluto-cms`) is the first backend on the driver. Its client plugin
registers `authDriver` and nothing else for the shell. See the [github-cms](../github-cms/SKILL.md)
skill.

- `user()` maps the session: GitHub login to `username`, plus `name` and `avatarUrl`.
- `loggedIn()` reads the session, which loads in the browser only. It is `false` on the server and
  in the first client render. The hydration is stable, and the bar appears after hydration.
- `ready()` waits for the first session read. `refresh()` reads it again. `signOut()` posts to the
  logout route.
- `signIn` is `PlutoCmsSignIn` (in `app/components/Pluto/Cms/`, so Tailwind scans it). It builds the
  login URL from `redirect` and shows the sign-in error alert.
- The module adds no page, no route middleware and no navbar.

A public layout that offsets its own header for the bar should use `usePlutoAdminBar().visible`.
The core blog template still uses `usePlutoCmsSession().loggedIn` with `useMounted()`. That works,
but `usePlutoAdminBar().visible` is the recommended API: it also hides the bar for a customer.

## Who sees the navbar

The rule is `navbarVisible` in `app/composables/internal/admin-shell.ts`. `usePlutoAdminBar()`
returns `{ visible }` with the same rule. An app that offsets its own header can use it.

- On `/admin/**`: any signed-in user, except on the public auth paths of the driver, and except a
  user who is known to be no staff (the no-access page).
- On a public page: staff only. Staff is a user with at least one capability, or `*`. A shop
  customer (signed in, no capability) never sees the bar.
- With no permissions driver, every signed-in user counts as staff. This matches `can()`, which
  fails open.

### How the bar avoids a flash and a hydration mismatch

Capabilities load in the browser. `app/plugins/pluto-auth-sync.client.ts` watches `loggedIn`. On
sign-in it loads the capabilities and syncs the admin language. On sign-out it clears the
capabilities. It also sets `usePlutoCapabilitiesKnown()`, a state that is `true` only after the
capabilities loaded in the browser. The server never sets it.

- On a public page, the bar needs `capabilitiesKnown` and `usePlutoAppMounted()`. The second one
  becomes `true` at the first `app:suspense:resolve`, when Nuxt ends the hydration. The
  capabilities alone are not enough: with no permissions driver, or a fast session read, they can
  be known before hydration. Both are `false` on the server and in the first client render, so
  the server HTML and the first client render agree. There is no hydration mismatch.
- A customer never sees the bar, because the bar waits for the answer before it shows.
- On `/admin/**` the bar does not wait. It renders from `loggedIn()`.

The trade-off: on a public page, the bar appears after the capabilities load. It is never in the
first paint, even for a backend that can render it on the server. An app that offsets its own
header with `usePlutoAdminBar()` sees the same delay. If the load fails, the bar stays hidden.

### The height token and the `<html>` marker

- `--pluto-admin-bar-height: 2.5rem` is on `:root` in `pluto-layer.css`. `PlutoNavbarAdmin` (`h-(--pluto-admin-bar-height)`)
  and the admin layout (the dashboard group `top`) read it. A site that offsets its own header
  under the bar reads it too.
- `--ui-header-height: 2.5rem` stays on `:root`, so an existing app does not change. A site with a
  taller header can set its own `--ui-header-height` (for example for the public pages only) and
  the admin bar keeps its height.
- `PlutoRoot` sets `data-pluto-admin-bar="true"` on `<html>` (`useHead` `htmlAttrs`) while
  `usePlutoAdminBar().visible` is `true`. It is client only: the attribute is never in the server
  HTML, the same as the bar. A site can write
  `:root[data-pluto-admin-bar] .site-header { top: var(--pluto-admin-bar-height) }`.

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

### Full-height click area

Each control in the bar fills the full height of the bar (39px, plus the 1px bottom border).
`PlutoNavbarHit` does this. It is a link (with `to`) or a button (without) that is `h-full`.
The visible pill is a ghost `UButton` rendered as a `<span>` inside it. The span takes no
pointer events. It gets the hover, active and focus-visible look from the `group` classes of the
link, so the pill looks the same as before. Use `PlutoNavbarHit` for a new control. Do not put a
plain `UButton` in the bar. `PlutoAdminUserMenu` uses the same pattern with its own pill.

The user menu dropdown renders in a portal target (`#pluto-admin-user-menu-portal`) that has
`data-pluto-admin-scope`. So the menu has the admin theme and the admin radius on a public page.

## Tab title

`PlutoRoot` sets the `titleTemplate` on admin routes only: "Page - Site name". The site name is
`site.name()`, then `runtimeConfig.public.websiteName` (not `Untitled`), then `pluto.app.name`
(`resolveSiteName`). Public routes keep the title template of the app. Every page under
`app/pages/**` sets `useHead({ title: () => t('...') })`. Content pages use the labels of
`usePlutoContentText`.

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
every layer migrates. The standalone CMS has migrated. Supabase has not.

`PlutoRoot` shows the public-page admin menu (`PlutoNavbarAdminMenu`) whenever a bar shows on a
public page, core or legacy.

## Migrating a backend to the auth driver

Written for the supabase layer. It also fits any other backend. The supabase layer keeps its own
files until it migrates. After it migrates, core owns the shell.

Register:

1. One `authDriver` in `definePlutoExtension`. Map the supabase user to `PlutoAuthUser`. Make
   `loggedIn()` readable on the server (the cookie session), so the bar renders in the server HTML.
   `ready()` resolves after the first session check and never rejects.
2. `signIn`: the email and password form, as a component. It gets the `redirect` prop. It logs in
   and goes to `redirect`, else `/admin/home`. Keep it in `app/` so Tailwind scans it.
3. `signInTitle`, `signInDescription` and `links` (`signUp: '/admin/signup'`,
   `forgotPassword: '/admin/forgot-password'`).
4. `publicPaths` for the other auth pages: `/admin/signup`, `/admin/forgot-password`,
   `/admin/update-password`, `/admin/confirm`. Use `{ path, signedIn: 'allow' }` for a page that a
   signed-in user must still open (`update-password`, `confirm`).
5. `accountMenu` items for what the layer adds to the user menu, and `site` for the site name and
   URL.
6. A permissions driver and a locale driver, as before. Core syncs both after sign-in.

Delete:

- `pages/admin.vue`. Core's parent route replaces it. Move its extra work to a banner
  (`adminBanners`, for example the migrations banner) or to a plugin.
- The `(auth)/login.vue` frame. Keep the other `(auth)` pages with the `auth` layout. Wrap their body in
  `PlutoAdminAuthCard` (default slot, `title` prop), so every auth page has the same frame. Do not keep a file at the core login path.
- The `auth` route middleware. Core's guard replaces it.
- A named setup middleware that must run before the sign-in rule. Move its check into
  `driver.guard`. Nuxt runs the global middleware of an extended layer (core) before the app's
  own, so a file prefix such as `00.` cannot put a layer's middleware first.
- `NavbarAdmin*` and the `navbar` registration (`useNavbarAdmin`).
- The permissions and locale sync plugins. `app/plugins/pluto-auth-sync.client.ts` does both.

Rename `setup-check`. It is not an auth concern: it sends a new install to `/admin/setup`. Keep
it as its own setup guard (a route middleware), and add `/admin/setup` to `publicPaths`. Do not run
it inside the auth middleware.

After the supabase layer migrates, remove the legacy shell fallback (see above).

## Tests

- `test/admin-shell.test.ts` — paths, `safeRedirect`, `guardDecision`, `staffDecision`, `isStaff`,
  `navbarVisible`, names.
- `test/permissions.test.ts` — also covers `ensureLoaded` (one request in flight, reload on a new user).
- `test/auth-driver.test.ts` — `validatePlutoAuthDriver`, last driver wins, account menu order,
  site info.
- `test/cms-module.test.ts` — the CMS module adds no page and no route middleware.
- The routes, the login page and the guard have no unit test beyond `guardDecision`. Check them in
  a built app: one `/admin/login` route, with the CMS on and with no driver.

## Page height and sticky headers

`PlutoRoot` styles `#__nuxt` with `min-height: 100dvh` and a flex column. It sets no fixed height
on `html`, `body` or `#__nuxt` for public pages. A fixed `height: 100%` would cap each wrapper at
one viewport. A sticky element (for example a Nuxt UI `UHeader`) sticks only inside its parent, so
a capped parent made the header leave after one viewport of scroll.

The admin keeps the fixed height: `:root[data-pluto-admin]` (set by `usePlutoAdminTheme`) gives
`html`, `body` and `#__nuxt` `height: 100%`. The dashboard group is `fixed inset-0`, so it does
not depend on it.

## The Pluto logo

`PlutoLogo` (`app/components/Pluto/PlutoLogo.vue`) is `public/img/pluto.svg` inline. The planet
keeps its colors in both color modes. The wordmark uses `currentColor`, so set a text color class
(`text-highlighted`). Set the height and `w-auto`. `mark` shows the planet only. The mouth uses a
mask with an id from `useId()`, so many logos can be on one page. The navbar and the sign-in card
use it with `aria-hidden="true"`, because the site name is next to it.

Static files for a site: `/img/pluto.svg` (the logo, black wordmark), `/img/pluto.png` (white
wordmark, for dark backgrounds), `/img/pluto-icon.svg` and `/img/pluto-icon.png` (the planet,
96 px, for a favicon). A site that extends Pluto serves them from the layer's `public/` folder.
