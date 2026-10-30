# @plutocms/pluto (moved)

This package is now **[`@plutocms/core`](https://www.npmjs.com/package/@plutocms/core)**. Core is
the base layer every Pluto app extends.

The last version of `@plutocms/pluto` only extends `@plutocms/core` and prints a warning. It gets
no more changes.

To move:

1. In `package.json`, replace `@plutocms/pluto` with `@plutocms/core`.
2. In `nuxt.config.ts`, replace `@plutocms/pluto` with `@plutocms/core`, and
   `@plutocms/pluto/layers` with `@plutocms/core/layers`.
3. If you use local layers, `PLUTO_PLUTO_PATH` is now `PLUTO_CORE_PATH`.

Docs: [pluto.vulmix.dev](https://pluto.vulmix.dev)
