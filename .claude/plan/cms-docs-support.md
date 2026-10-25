# Core support for a docs site (pluto 0.19.0)

Status: done
Started: 2026-10-25
Projects: pluto
Branch / PR: feat/cms-docs-support

## Context

- Goal: generic GitHub CMS changes that a docs site needs. Nested paths, a source editor mode,
  an admin bar height token, a post type fix.
- Why: see `../../../.claude/plan/docs-site.md` (workspace plan), part "Core".
- Decisions: the design in the workspace plan. No commit and no push: the user reviews.
- Key files: `modules/pluto-cms/runtime/server/{adapter,store,utils}`, `shared/utils`,
  `app/pages/admin/content`, `server/api/_pluto/content`.

## Checklist

- [x] PR1 nested paths.
- [x] PR2 source mode.
- [x] PR3 admin bar height token.
- [x] PR4 post type fix and docs.
- [x] `bun run build` once at the end.
- [x] `FEATURES.md` line and skill files.

## Log

- 2026-10-25: branch made. Work starts with PR1.
- 2026-10-25: PR1 done (code, tests, skills). PR2 next.
- 2026-10-25: PR2 done. PR3 next.
- 2026-10-25: PR3, PR4, docs and build done. Waiting for the user review and the commit.
