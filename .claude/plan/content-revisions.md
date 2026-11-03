# Revisions with restore

Roadmap: Phase 1, "Revisions with restore". Core gives the contract and the UI; each backend gives
the storage. This PR: core + the Git CMS. Supabase follows in its own PR (a revisions table).

## Decisions

- **Two optional adapter reads, no restore call.** `listRevisions(ctx, id, { limit, cursor })` and
  `getRevision(ctx, id, revisionId)`. Restore fills the form with the old values and the user
  saves: validation, capabilities, hooks, the publish rules and the `_version` conflict check all
  apply, the restore is a normal revision, and it can be undone. Restore keeps the current slug,
  status, timestamps and `_version`.
- **Routes** (own base paths: an id can hold slashes):
  - `GET /api/_pluto/content-revisions/<type>/<...id>?limit&cursor` → `{ supported, data, nextCursor }`.
  - `GET /api/_pluto/content-revision/<type>/<revision>/<...id>` → the item at that revision.
  - Both need `type.capabilities.write` (history is for editors). No adapter method → `supported: false`.
- **`PlutoContentRevision`**: `id`, `createdAt`, `author { name, login?, avatarUrl? }`, `message?`,
  `action?` (`create`, `update`, `publish`, `unpublish`, `rename`, from the Pluto commit message).
- **Git CMS**: store gets optional `history(path, { limit, cursor }, auth)` and `readAt(path, oid, auth)`.
  GitHub: GraphQL `history(path:)` on the branch, the blob at `<oid>:<path>`. fs: `git log` / `git show`
  in the project repo (no repo → empty). Memory: a snapshot per commit (tests). The snapshot store has
  none; the snapshot wrappers send these to GitHub. Renames are not followed (v1).
- **UI**: a core toolbar item `PlutoContentHistory` for every type ('*'). It asks for the first page
  when an edit page opens; no support or no revision → nothing shows. A History slideover: the list
  (avatar, action, relative time, "Load more"), a diff of the selected revision against the form
  (changed fields; a line diff for long text), and "Restore this version".
- Pure utils: `diffLines` (LCS, capped) and the field diff, in `shared/utils`.

## Checklist

- [x] Contract types, handlers, routes, tests.
- [x] Git CMS: store `history`/`readAt` (github, fs, memory, wrappers), adapter methods, tests.
- [x] Diff utils and tests.
- [x] `PlutoContentHistory` + registration + i18n (en, pt-BR).
- [x] Live check: the post editor takes the restored body (local Git), screenshots.
- [ ] Live check of the docs block editor after a restore (not done).
- [x] Docs: content-model, git-cms, admin-view-chrome skills, FEATURES.md, plutocms docs, ROADMAP.md.
- [ ] Next PR: Supabase revisions.
