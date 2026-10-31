# Layer @plutocms/nuxt-content

Status: in progress
Started: 2026-10-25
Projects: nuxt-content (new), plutocms (docs site), pluto (read only)
Branch / PR: none yet (new repo, no remote, no commit)

## Context

- Goal: a Pluto layer that edits the Markdown pages of a Nuxt Content site in the Pluto admin.
  The docs site `plutocms/plutocms` is the first user.
- Why: see the workspace plan `.claude/plan/docs-site.md` (Design, "Layer").
- Decisions:
  - The layer defines no Nuxt Content collection. The app does (`content.config.ts`).
  - The layer ships the plugins in its own `app/plugins` and `server/plugins` dirs. They read
    `runtimeConfig.public.plutoNuxtContent`, which the module sets only when the CMS is on.
  - Pure code (`createDocsType`, `contentRoutePath`, the option helper) has no Nuxt import, so
    plain Vitest tests it.
  - Needs pluto 0.19 (nested ids, `files.frontmatter`, source mode, admin bar token).
- Key files: `modules/pluto-nuxt-content/`, `shared/utils/docs-type.ts`,
  `shared/utils/content-route.ts`, `app/components/Pluto/NuxtContent/PlutoFieldMdc.vue`,
  `app/composables/pluto-content-edit-link.ts`, `app/assets/css/pluto-layer.css`.
- Open questions: none.

## Checklist

- [x] Repo setup (package.json, CI, release files copied from pluto).
- [x] Module `plutoNuxtContent` and its options helper.
- [x] `createDocsType` and `contentRoutePath`.
- [x] Client plugin and Nitro plugin.
- [x] `PlutoFieldMdc` widget.
- [x] `usePlutoContentEditLink`.
- [x] `pluto-layer.css` (admin bar offset).
- [x] i18n en and pt-BR.
- [x] Tests, lint, typecheck pass.
- [x] README, FEATURES.md, skills.
- [ ] First publish by the user (trusted publishing cannot create a package); refresh the lock.

## Log

- 2026-10-25: repo created with `git init`. Nothing is committed: the user reviews.
- 2026-10-25: all code, tests, docs and skills written. Lint, typecheck (no error in this repo; 9 errors in `../pluto` files, from two copies of `@nuxt/ui` types when pluto is a local path) and 54 tests pass with `PLUTO_PLUTO_PATH`. `bun.lock` was made with `@plutocms/pluto ^0.18.0` because 0.19 is not on npm: refresh it after the pluto release (`bun install` with `^0.19.0`). Left: the user commits, creates the GitHub repo, publishes 0.1.0 by hand. Browser checks of the widget and the offset CSS are not done.
