# pluto

This is `@plutocms/pluto`, the core layer of Pluto. The workspace `CLAUDE.md` (one directory
up) has the shared policy. `FEATURES.md` lists every feature, and each feature has its detail in
`.claude/skills/<feature-slug>/SKILL.md`. Read the skill of a feature before you change it.

## Commands

- `bun install`: install. The `postinstall` hook runs `nuxt prepare`.
- `bun run dev`: run this layer as an app (`nuxt dev --no-fork`).
- `bun run test`: run the Vitest suite in `test/`. The tests are plain Vitest, with no Nuxt
  environment. Mock the Nuxt imports (see `test/fixtures/`).
- `bun run lint`, `bun run typecheck`, `bun run build`.

CI runs `lint`, `typecheck`, `test` and `build`. Run all four before you open a PR. Do not run
`typecheck` or `build` while the dev server runs, because both write `.nuxt/`.

## Local layers

- `layers.ts` is the `plutoLayer` helper for apps (see the `local-layers` skill).
- `PLUTO_UTILS_PATH=../utils` makes this layer extend a local `utils` checkout instead of the npm
  package.
- Emi Biscuit (`../../ojvribeiro/emibiscuit.com`) extends this checkout in dev. Use it to try a
  change in a real app. Its production build uses the npm package, so a change must be released
  first.

## Rules for this layer

- Put every user-facing string in `i18n/locales/en.json` and `i18n/locales/pt-BR.json`.
- Admin code uses Nuxt UI semantic classes, not raw Tailwind colors (see the `admin-theme` skill).
- The GitHub CMS (`modules/pluto-cms`) is `'auto'` by default: on, unless a backend layer is present. When it is off, it
  must add nothing to the app. Keep its runtime files on explicit imports.
- A new content adapter must pass `test/contracts/content-adapter.contract.ts`.
