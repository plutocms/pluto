# Local layers

The `plutoLayer` helper keeps the `extends` of an app clean. It is for Pluto development, layer
development, and an app that needs local layers instead of npm. A normal app does not need it.

## Use

```ts
// nuxt.config.ts
import { plutoLayer } from '@plutocms/pluto/layers'

export default defineNuxtConfig({
  extends: [plutoLayer('@plutocms/nuxt-content')],
})
```

`plutoLayer(name, options?)` returns `[source, { install }]`. Options: `install` (default `true`),
`root` (the folder with the checkouts; it wins over `PLUTO_LOCAL_ROOT`).

## Files

- `layers.ts` (at the package root) — the helper. Node built-ins only (`node:fs`, `node:path`,
  `node:process`). No Nuxt import, because Nuxt loads `nuxt.config.ts` before any module runs.
- `test/layers.test.ts` — the unit tests, with a temp dir of fake checkouts.

## Import path

The app imports `@plutocms/pluto/layers`. The package has `main: ./nuxt.config.ts` and no `exports`
field, so Node and jiti resolve a deep path to the file `layers.ts` in the package. An `exports`
field would block the other deep imports that layers and tests use, so do not add one. `.npmignore`
is a denylist, so `layers.ts` ships to npm.

With a strict package manager (pnpm), the app must list `@plutocms/pluto` in its own dependencies
to import the helper. With npm and Bun, the copy that a layer brings is hoisted, and the import
works.

## Rules

- Local mode is on when `PLUTO_LOCAL_ROOT` (or `options.root`) is set, unless
  `PLUTO_USE_LOCAL=false`. A relative root resolves from the current working directory.
- A checkout exists when `<root>/<folder>/nuxt.config.ts` exists. The folders are `utils`,
  `pluto`, `supabase`, `supabase-shop`, `supabase-storage`, `supabase-blog`, `nuxt-content`.
- The helper sets `PLUTO_<NAME>_PATH` (upper case, `-` to `_`) for each checkout that exists and
  is not set yet. The `nuxt.config.ts` of each layer reads that variable, so the upstream layers go
  local too.
- An explicit `PLUTO_<NAME>_PATH` always wins, in local mode and in default mode.
- When the checkout of `name` is missing, the helper returns the package name.
- A production host has no `.env`, so it uses the npm packages.
