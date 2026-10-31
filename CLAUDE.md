# pluto

This repo holds the core layer of Pluto, `@plutocms/core` (`packages/core`), the feature layers
(`packages/layers/<name>`: `@plutocms/docs`), and the add-on layers (`packages/layers/addons/*`,
for example `@plutocms/3d`). The other layers move here one by one (see
`.claude/plan/monorepo-layers.md` in the workspace). Each layer keeps its own skills
(`packages/layers/<name>/.claude/skills/`), its own ESLint config (ESLint finds the nearest one)
and its own tests and typecheck; the root scripts run them all. It is a Bun workspace. The
workspace `CLAUDE.md` (one directory up) has the shared policy. `packages/core/FEATURES.md` lists
every feature of core, and each feature has its detail in
`.claude/skills/<feature-slug>/SKILL.md`. Read the skill of a feature before you change it. A
path in a skill of core is relative to `packages/core`.

## Commands

Run them at the root. The root scripts call the packages.

- `bun install`: install. The `postinstall` hook of the root package runs `dev:prepare` (`nuxt prepare`) in
  `packages/core`. The published packages have no install script.
- `bun run dev`: run the playground (`playground/`), an app that extends `@plutocms/core` and
  `@plutocms/3d` by name. The workspace links the names to `packages/`. Do not save content or
  upload files in it with the GitHub CMS: the local Git commits go into this repo.
- `bun run test`: run the Vitest suites of core (`packages/core/test/`) and of the add-ons. The tests are plain Vitest, with no Nuxt
  environment. Mock the Nuxt imports (see `test/fixtures/`).
- `bun run lint`, `bun run typecheck`, `bun run build`.

ESLint uses `@nuxt/eslint-config` in the root `eslint.config.mjs`. The layers do not register the
`@nuxt/eslint` module, because a module of a layer runs in every app that extends it.

CI runs `lint`, `typecheck`, `test` and `build`. Run all four before you open a PR. Do not run
`typecheck` or `build` while the dev server runs, because both write `packages/core/.nuxt/`.

## Local layers

- `packages/core/layers.ts` is the `plutoLayer` helper for apps (see the `local-layers` skill).
- Core extends no other layer. `@plutocms/utils` is retired (2026-10-31): its helpers that core
  uses are in `packages/core/shared/utils/` (`domainFromUrl` in `url.ts`).
- A consumer app can extend this checkout in dev (the workspace `CLAUDE.md` names it). Use it to
  try a change in a real app. Its production build uses the npm package, so a change must be released
  first.

## Rules for this layer

- Put every user-facing string in `packages/core/i18n/locales/en.json` and `pt-BR.json`.
- Admin code uses Nuxt UI semantic classes, not raw Tailwind colors (see the `admin-theme` skill).
- The GitHub CMS (`modules/pluto-github`) is `'auto'` by default: on, unless a backend layer is present. When it is off, it
  must add nothing to the app. Keep its runtime files on explicit imports.
- A new content adapter must pass `packages/core/test/contracts/content-adapter.contract.ts`.
