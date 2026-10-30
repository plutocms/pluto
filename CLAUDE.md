# pluto

This repo holds the core layer of Pluto, `@plutocms/core` (`packages/core`), and the add-on
layers (`packages/layers/addons/*`, for example `@plutocms/3d`). It is a Bun workspace. The
workspace `CLAUDE.md` (one directory up) has the shared policy. `packages/core/FEATURES.md` lists
every feature of core, and each feature has its detail in
`.claude/skills/<feature-slug>/SKILL.md`. Read the skill of a feature before you change it. A
path in a skill of core is relative to `packages/core`.

## Commands

Run them at the root. The root scripts call the packages.

- `bun install`: install. The `postinstall` hook runs `nuxt prepare` in `packages/core`.
- `bun run dev`: run core as an app (`nuxt dev --no-fork` in `packages/core`).
- `bun run test`: run the Vitest suites of core (`packages/core/test/`) and of the add-ons. The tests are plain Vitest, with no Nuxt
  environment. Mock the Nuxt imports (see `test/fixtures/`).
- `bun run lint`, `bun run typecheck`, `bun run build`.

CI runs `lint`, `typecheck`, `test` and `build`. Run all four before you open a PR. Do not run
`typecheck` or `build` while the dev server runs, because both write `packages/core/.nuxt/`.

## Local layers

- `packages/core/layers.ts` is the `plutoLayer` helper for apps (see the `local-layers` skill).
- `PLUTO_UTILS_PATH=../../../utils` (in `packages/core/.env`) makes core extend a local `utils`
  checkout instead of the npm package.
- A consumer app can extend this checkout in dev (the workspace `CLAUDE.md` names it). Use it to
  try a change in a real app. Its production build uses the npm package, so a change must be released
  first.

## Rules for this layer

- Put every user-facing string in `packages/core/i18n/locales/en.json` and `pt-BR.json`.
- Admin code uses Nuxt UI semantic classes, not raw Tailwind colors (see the `admin-theme` skill).
- The GitHub CMS (`modules/pluto-github`) is `'auto'` by default: on, unless a backend layer is present. When it is off, it
  must add nothing to the app. Keep its runtime files on explicit imports.
- A new content adapter must pass `packages/core/test/contracts/content-adapter.contract.ts`.
