# Permissions

This feature lets a layer declare capabilities, and lets one backend layer register the driver
that loads the current user's capability list. Core reads that list to decide what the admin UI
shows, and to decide who can enter the admin (see "Staff-only admin").

It extends the [extension registry](../extension-registry/SKILL.md). Read that skill file
first. This feature adds:

- Two new fields to `shared/types/registry.ts`: `PlutoCapability` and `PlutoPermissionsDriver`.
- Two new fields on `PlutoExtension`: `capabilities` and `permissionsDriver`.
- Two new buckets on `PlutoRegistry`: `capabilities` and `permissionsDrivers`.
- `app/composables/pluto-permissions.ts` — `usePlutoCapabilities()` and `usePlutoPermissions()`.
- `test/permissions.test.ts` — unit tests for the two composables above.

## Declaring a capability

A layer that gates a feature behind a permission declares that permission as a capability. Call
`definePlutoExtension` the same way you would for a nav item or a dashboard widget:

```ts
// app/plugins/pluto-registrations.ts
export default defineNuxtPlugin(() => {
  definePlutoExtension({
    id: 'supabase-blog',
    capabilities: [
      {
        id: 'posts-publish',
        key: 'posts:publish',
        label: 'Publish posts',
        description: 'Change a post from draft to published.',
      },
    ],
  })
})
```

A capability key uses the format `<namespace>:<action>`, lowercase, for example `posts:publish`
or `settings:manage`. Use a colon. A setting key (a different, unrelated string a layer's
settings driver stores) uses a dot instead, for example `blog.posts_per_page`. Do not mix the
two formats up.

## `key` vs `id`: read this before you register a capability

`PlutoCapability` has both an `id` and a `key` field, and they hold different strings on
purpose.

The registry rewrites every entry's `id` to `<extensionId>:<id>` (see
`app/composables/internal/registry-factory.ts`). This rewrite is correct and wanted for `id` —
it is how the registry keeps two layers from colliding when they both pick the id `home`. But a
capability string is not an id. It is a value your backend stores, checks, and compares byte for
byte. If `PlutoCapability` reused `id` as the capability string, the registry would silently
corrupt it: a layer registering `id: 'posts:publish'` would end up with the real capability
string reading `supabase-blog:posts:publish`, not `posts:publish`, and every server-side check
for `posts:publish` would fail.

`key` exists to avoid this. `key` is never rewritten. `id` still gets the `<extensionId>:<id>`
treatment, same as every other registry entry, and identifies this registry entry only — not
the permission. Register a capability with a plain, un-prefixed `id` (for example
`posts-publish`), and put the real, colon-formatted permission string in `key`
(`posts:publish`).

## `usePlutoCapabilities()`

Returns every capability declared by every layer, in registry order:

```ts
const { items } = usePlutoCapabilities()
```

`items` is a `ComputedRef<PlutoCapability[]>`. This bucket is documentation and typing only. The
database stores capability strings as free text, and never validates them against what is
registered here. A capability works even if no layer ever declares it through
`usePlutoCapabilities()` — the registry entry only helps a later admin UI list and label known
capabilities. Nothing in core enforces that a capability checked by `can()` has a matching
registry entry.

### Capability groups

`usePlutoCapabilities()` also returns `groups`, for a picker such as a Roles editor. It groups the
capabilities by owner: the `<owner>:` prefix of the registry id (the extension id). The group
label is the key `<owner>.capabilities.group` when it exists in the locale files, else the owner
id. `groupsFor(keys)` does the same and adds an "Other" group (`pluto.capabilities.otherGroup`)
with the strings in `keys` that no layer declares. A layer names its group by adding
`<owner>.capabilities.group` to its locale files.

A settings page that is admin only uses the capability `'*'` in `settingsPages`. See the
[extension registry](../extension-registry/SKILL.md).

## `usePlutoPermissions()`

Returns the current user's loaded capability list, and a `can()` check, backed by whichever
`PlutoPermissionsDriver` is registered:

```ts
const { granted, loaded, status, hasDriver, isAdmin, load, ensureLoaded, clear, can } = usePlutoPermissions()

await ensureLoaded(user.id) // populates `granted` for this user, once
can('posts:publish') // true if the user holds this capability, or holds '*'
```

- `granted` — the raw list of capability strings the driver returned.
- `loaded` — true once `load()` has completed at least once.
- `status` — `'idle'` or `'loading'`.
- `hasDriver` — true when a layer has registered a `PlutoPermissionsDriver`.
- `isAdmin` — true when `granted` includes the wildcard `'*'`.
- `load(userId?)` — calls the registered driver's `load()` and stores the result. One request runs
  at a time: a call while a request is in flight returns the same promise. The request is kept on
  `nuxtApp`. A call for another user id starts a new request, and the older result is dropped.
  Does nothing if no driver is registered.
- `ensureLoaded(userId)` — returns at once when the list is already loaded for this user id. It
  joins a request in flight for the same id. It loads again when the user id changed. It rejects
  when the driver rejects, so the caller can show an error.
- The loaded list remembers the user id it belongs to. `clear()` resets it and drops a request in
  flight.
- `clear()` — resets `granted`, `loaded` and the user id. Call this on sign-out.
- `can(capability)` — true if the user holds `capability`, or holds `'*'`.

**`can()` fails OPEN when no permissions driver is registered.** A site with no permissions
backend also has no server-side guard, so hiding UI in that case would only be theatre, and
would break a core-only install with nothing registered yet. Check `hasDriver` if a caller needs
to tell "everything is allowed because nothing is gated yet" apart from "everything is allowed
because the user actually holds every capability".

**`can()` is a UI convenience. It is never a security boundary.** It only decides what a button
or a page shows. The real enforcement is a backend layer's own server-side guard (its own
`requireCapability`-equivalent), backed by row-level security in the database. Hiding a "Publish"
button with `can('posts:publish')` does nothing to stop a user who calls the API directly. Do
not treat `can()` returning `false` as proof an action is blocked.

## Staff-only admin

Core wires the list into two places:

- `app/plugins/pluto-auth-sync.client.ts` calls `ensureLoaded(userId)` on sign-in and `clear()` on
  sign-out.
- `app/middleware/pluto-admin-auth.global.ts` awaits `ensureLoaded(userId)` for a signed-in user
  on a private admin path. A user with no capability goes to `/admin/no-access`. See the
  [admin-shell](../admin-shell/SKILL.md) skill.

Both callers share one request. `@plutocms/supabase` is the reference implementation of a
permissions driver, and the enforcement side.

## Known limits, out of scope for this pass

- No roles or capabilities admin UI. No role-picker component.
- No capability hierarchies or namespace wildcard matching. The only wildcard is the single,
  global `'*'`.
- No server-side guard ships in this repo. `pluto` (core) gains no `server/` directory in this
  wave.
- A driver whose `load()` returns `[]` for an admin (for example a failed role query) locks that
  admin out of the admin pages. The driver must return `['*']` for an admin.
