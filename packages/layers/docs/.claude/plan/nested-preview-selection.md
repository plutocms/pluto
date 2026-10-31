# Select inner blocks in the preview

Status: done (not committed)
Started: 2026-10-26
Projects: nuxt-content (branch `feat/block-model`, part of the visual editor, not released)
Branch / PR: `feat/block-model` (draft PR #16)

## Context

- User (2026-10-26): select inner blocks inside sections directly in the preview; a click opens
  the form of that block. Today a click selects the top-level block only, because the preview marks
  only the top-level elements with `data-pluto-block`.
- Decisions: the editor sends the inner components of each top-level component (a tree of `id`,
  `name`, `label`). The frame marks the matching component elements of the parsed AST, in source
  order (preorder, by tag name). A click and a hover take the innermost marked element. The
  selection the editor sends is the deepest component on the path of the selected block. Esc in
  the preview selects the parent. Text, code and raw children are not marked: a click on them
  selects the nearest marked component.
- Commits only when the user says so.

## Checklist

- [x] Protocol: `PlutoPreviewChild`, `children` on `PlutoPreviewBlock`, validator.
- [x] `toPreviewBlocks` sends the children; the frame host translates their labels.
- [x] `markPreviewChildren` (pure, `shared/utils/blocks/preview-marks.ts`) + tests, with a corpus
      test: every inner component of the 48 docs pages gets marked.
- [x] Preview page: marks, labels, parent map, Esc, fallback to a marked ancestor.
- [x] Host: send the deepest component of the selection path.
- [x] Skill `block-editor` updated; checked in Chrome.

## Log

- 2026-10-26: plan made.
- 2026-10-26: built. 201 tests pass (10 new, with a corpus test: every inner component of the 48
  pages is marked). In Chrome on the landing: 16 inner blocks are marked; a click on "Get started"
  selects the Button (row and form), Esc selects the Hero.
