# Block editor UI

Status: in progress
Started: 2026-10-25
Projects: nuxt-content, plutocms (docs site)
Branch / PR: feat/block-model (draft PR #16), docs site branch feat/visual-editor

## Context

- Goal: the visual block editor UI (Phase 2 of the workspace plan `.claude/plan/visual-block-editor.md`).
- Decisions: see the workspace plan. The preview is a same-origin iframe of `/_pluto/preview`. The
  outline is a custom list with SortableJS (not UTree), for keyboard and drag control. SortableJS is
  used directly (no `@vueuse/integrations`).
- Key files: `app/components/Pluto/NuxtContent/Blocks/`, `app/pages/_pluto/preview.vue`,
  `app/components/PlutoContentPreview.vue`, `app/composables/pluto-block-editor.ts`,
  `shared/utils/blocks/editor.ts`.
- Not released: the user sees the editor before nuxt-content 0.4.0.

## Checklist

- [x] Editor state composable, preview page, preview wrapper, route rules.
- [x] Preview frame, editor, outline, palette.
- [x] Inspector, prop control, text editor, raw editor.
- [x] `PlutoFieldMdc` host, `docs-type.ts`, remove the "View page" action.
- [x] i18n (en, pt-BR), narrow screens (390, 768, 1024), keyboard, tests, skills, FEATURES.md, README.
- [x] Docs site branch: `app.vue`, `plutoBlocks`, the guide "Edit pages visually".
- [x] Screenshots for the user.
- [ ] The user checks the editor. Then: merge the PR, release 0.4.0 (release PR), bump the docs site.

## Log

- 2026-10-25: built the UI on `feat/block-model`. Checked in headless Chrome on the docs site
  (dev, pluto 0.21.0 from npm): open and save with no edit gives no diff, one edit gives a one line
  diff, Undo and Redo, Alt+Up and Alt+Down, drag, 1440, 1024, 768 and 390 px, light and dark.
- Known limits: see the block-editor skill ("Not in this version").
