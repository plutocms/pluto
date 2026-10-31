# Run-time render mode

Status: in progress
Started: 2026-10-26
Projects: nuxt-content, plutocms (docs site)
Branch / PR: feat/runtime-render (no PR yet)

## Context

- Goal: option `plutoNuxtContent.render: 'build' | 'runtime'` (default `'build'`). In `'runtime'` the
  public pages read the Markdown from the content repo at request time, through the registered
  content adapter (GitHub CMS store and cache), parse it with `parseMarkdown`, and render it with
  the same components. The navigation and the surround come from the same listing.
- Parent plan: workspace `.claude/plan/publish-status-and-runtime-mode.md`, "Spec B".
- Decisions:
  - Server routes `/api/_pluto/nuxt-content/:type/{page,navigation,surround}`, added by the module only in
    runtime mode. They use the auto-imported core server utils (`requireContentAdapter`) and mark the
    request anonymous with the `plutoCmsAnonymous` context key.
  - Pure code (navigation tree, surround, route match) is in `shared/utils/runtime-content.ts`.
  - Composables hide the mode: `usePlutoContentPage`, `usePlutoContentNavigation`, `usePlutoContentSurround`.
  - Search stays build time. `.navigation.yml` and frontmatter keys that are not type fields are not
    read in runtime mode (v1).
  - No core change.

## Checklist

- [x] Option + module wiring + types.
- [x] Pure utils + tests.
- [x] Server routes.
- [x] Composables.
- [x] Skill + FEATURES + README.
- [x] Docs site: composables, option switch, docs section.
- [x] lint, typecheck, test; checked in Chrome (build and runtime).

## Spec C checklist (hybrid mode)

- [x] Option `render: hybrid|build|runtime` (default hybrid), `runtimeMaxAge`.
- [x] Manifest (module, Node): path -> version, virtual module `#pluto-nuxt-content/manifest`.
- [x] Pure: diffManifest, folder config merge, frontmatter passthrough.
- [x] Server: hybrid routes, build data via `@nuxt/content/server`, `.navigation.yml` via `adapter.readFile`, `markPublicRead`.
- [x] Composables call the routes in hybrid and runtime.
- [x] `liveOnSave` on the type in hybrid and runtime.
- [x] Tests, lint, typecheck.
- [x] Docs site: hybrid for testing, no prerender of docs pages, docs page.
- [x] Browser check, dev and production build.

## Log

- 2026-10-26: plan made.
- 2026-10-26: built and checked in Chrome (build and runtime, fs store). lint, typecheck, test pass.
  Next: the user reviews. Commit, PR and release only on the user's word.
- 2026-10-26: Spec C built (hybrid default, manifest, parity, liveOnSave, docs site hybrid). lint, 277 tests pass. Checked in Chrome: dev and production build (fs store at run time). Typecheck is clean only with a pluto that has the contract (PLUTO_PLUTO_PATH=pluto-wt); the errors left are in pluto-wt and come from a second @nuxt/ui copy. Note: a Windows production build of the docs site needs a local buildDir while docs-rt/node_modules is a junction. Waiting for the user to commit and release.
