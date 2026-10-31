# Block model (pure part of the visual block editor)

Status: in progress
Started: 2026-10-25
Projects: nuxt-content
Branch / PR: feat/block-model

## Context

- Goal: the pure model of the visual block editor: parse, serialize, edit, history, presets,
  registry, and the preview protocol. No UI yet.
- Why: the workspace plan `.claude/plan/visual-block-editor.md` (Phase 0 and the pure part of Phase 2).
- Decisions: see the workspace plan. One Text block for each H2 section. Props from presets, the
  `plutoBlocks` app config, and the document. The text between the blocks stays as it was.
- Key files: `shared/utils/blocks/`, `test/blocks-*.test.ts`, `test/fixtures/mdc/`.
- Open questions: none for this part.

## Checklist

- [x] Remark deps pinned to the `@nuxtjs/mdc` 0.23 versions.
- [x] `types.ts`, `parse.ts`, `serialize.ts`, `mdc-props.ts`, `tree.ts`.
- [x] Corpus test: 48 of 48 pages write back byte for byte.
- [x] Edit tests: one edit changes only that block.
- [x] `operations.ts`, `history.ts` and tests.
- [x] `presets.ts`, `registry.ts`, `plutoBlocks` typing, i18n en and pt-BR, tests.
- [x] `preview-protocol.ts` and tests.
- [x] Lint, typecheck and tests pass.
- [x] Skill `block-model` and `FEATURES.md` line.
- [x] The UI, the preview page and the `mdc` widget. See `block-editor-ui.md`.

## Log

- 2026-10-25: built the pure model on `feat/block-model`. The UI part waits for pluto 0.21.0.
