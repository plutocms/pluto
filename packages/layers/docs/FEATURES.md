# Features

This file lists every implemented feature of this project. Each entry links to a skill file
with full detail, so this file stays short.

See the workspace-level `CLAUDE.md` (one directory up) for the delegation, writing, and git
policies shared by every project here.

- Docs setup: the `plutoDocs` module, its options, and the plugins that register
  the types. See @.claude/skills/docs-setup/SKILL.md.
- Zero config: an existing Nuxt Content v3 site (Docus) needs only `extends`. The types come from its page
  collections and the render mode is `build`. Core wraps the root and keeps the header under the admin
  bar. See @.claude/skills/docs-setup/SKILL.md.
- Docs preset: the `docs` page type, the frontmatter hooks, and tree order. See
  @.claude/skills/docs-preset/SKILL.md.
- MDC field: the `mdc` field widget. Visual mode (the block editor) and Markdown mode (with the
  Insert menu of snippets). See @.claude/skills/mdc-field/SKILL.md.
- Render modes: `plutoDocs.render` is `'hybrid'` (default: the build data, and the repository for the
  pages that changed after the build), `'build'` or `'runtime'`. A build manifest, server routes, `.navigation.yml`
  and frontmatter parity, and the composables `usePlutoContentPage`, `usePlutoContentNavigation` and
  `usePlutoContentSurround` that hide the mode. The layer routes are on the public API
  (`/api/pluto/v1/docs/:type/{page,navigation,surround}`, `{ data }` answers), and the docs type is
  public on core's `/api/pluto/v1/content/<type>`. See @.claude/skills/docs-setup/SKILL.md.
- Page links: the View link of the form (`previewUrl`), the "New Page" and "Edit Page" buttons of the admin bar (core draws them from `adminBar`),
  `contentRoutePath`, `contentEditPath`, and `usePlutoContentEditLink`. See
  @.claude/skills/page-links/SKILL.md.
- Block model: the pure model of the visual block editor (parse, serialize, edit, history,
  presets, registry, preview protocol). The text of an unedited block stays byte for byte. See
  @.claude/skills/block-model/SKILL.md.
- Block discovery: a component in `components/content/` (the app or a layer) that calls
  `definePlutoBlock({...})` becomes a block in the palette, with its props and slots read from its
  TypeScript types. Opt-in. Core finds the components (the content-components skill of pluto); the
  palette adds the shared labels of the presets. See @.claude/skills/block-model/SKILL.md.
- Block editor: the visual editor for the page body. A live preview, the block list, the palette, and
  the controls of the selected block, with no raw MDC. See @.claude/skills/block-editor/SKILL.md.
- Image block (`::pluto-figure`): an image of the media library (the `media` prop type: a picker that
  fills the URL, the size and the alt text), a caption, and an image for the dark mode.
- A page type over the whole content dir (`source: ''`) never lists the media records
  (`media/`).
